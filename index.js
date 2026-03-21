const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

// Global variable to track which character is currently active
let currentConfigPath = null;

// --- 1. PATH & FILE HELPERS ---

function getRootDir() {
  const isPackaged = app.isPackaged;
  if (!isPackaged) return __dirname;
  
  if (process.platform === 'darwin') {
    return path.resolve(path.dirname(app.getPath('exe')), '../../..');
  }
  return path.dirname(app.getPath('exe'));
}

function scanConfigs() {
  const dir = getRootDir();
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.json'));
  
  const configs = [];
  files.forEach(file => {
    try {
      const fullPath = path.join(dir, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      // Only treat it as a config if it has a "name" or "img_path"
      if (data.name || data.img_path) {
        configs.push({
          name: data.name || file, // Fallback to filename if no name
          path: fullPath
        });
      }
    } catch (err) {
      console.warn(`Skipping invalid JSON: ${file}`);
    }
  });
  return configs;
}

function loadConfig(filePath) {
  try {
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    return { 
      img_size: { width: 100, height: 100 }, 
      img_path: "img.png", 
      dialogue: ["Error loading config"] 
    };
  }
}

// --- 2. WINDOW CREATION ---

function createWindow() {
  const rootDir = getRootDir();


  // If no config selected yet, try to find 'config.json', or just the first valid one
  if (!currentConfigPath) {
    const allConfigs = scanConfigs();
    const defaultConfig = allConfigs.find(c => c.path.endsWith('config.json'));
    currentConfigPath = defaultConfig ? defaultConfig.path : (allConfigs[0]?.path || null);
  }

  // Initial load to get size
  const config = currentConfigPath ? loadConfig(currentConfigPath) : { img_size: { width: 100, height: 100 } };
  
  const winWidth = (config.img_size?.width || 100) + 200; 
  const winHeight = (config.img_size?.height || 100) + 150;

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    win.setAlwaysOnTop(true, 'screen-saver');
  }

  win.loadFile('index.html');

  // When window loads, read the CURRENT config file and send it
  win.webContents.on('did-finish-load', () => {
    if (!currentConfigPath) return;

    const freshConfig = loadConfig(currentConfigPath);
    
    // Resize window dynamically based on the new character's size
    const newWidth = (freshConfig.img_size.width || 100) + 200;
    const newHeight = (freshConfig.img_size.height || 100) + 150;
    win.setSize(newWidth, newHeight);

    // Send data to renderer
    win.webContents.send('init-data', { config: freshConfig, rootDir });
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;
app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    isQuitting = true;
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      wins[0].webContents.send('show-quit-dialogue');
      setTimeout(() => {
        app.quit();
      }, 3000);
    } else {
      app.quit();
    }
  }
});

// --- DATA STORE HELPERS ---
const dataFilePath = path.join(getRootDir(), 'mascot_data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  } catch(e) {
    return { clicks: {}, inputs: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

function getLocalHourKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  return `${year}-${month}-${day}-${hour}:00`;
}

ipcMain.on('mascot-clicked', () => {
  const data = loadData();
  const hourKey = getLocalHourKey();
  data.clicks[hourKey] = (data.clicks[hourKey] || 0) + 1;
  saveData(data);
});

function getLocalTimeStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

ipcMain.on('user-input-saved', (event, text) => {
  const data = loadData();
  data.inputs.push({ time: getLocalTimeStr(), text });
  saveData(data);
});

// --- DASHBOARD & EDITOR WINDOWS ---
let dashboardWin = null;
function openDashboard() {
  if (dashboardWin) { dashboardWin.focus(); return; }
  dashboardWin = new BrowserWindow({
    width: 600, height: 500,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  dashboardWin.loadFile('dashboard.html');
  dashboardWin.on('closed', () => { dashboardWin = null; });
}

let editorWin = null;
function openEditor() {
  if (editorWin) { editorWin.focus(); return; }
  editorWin = new BrowserWindow({
    width: 600, height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  editorWin.loadFile('editor.html');
  editorWin.on('closed', () => { editorWin = null; });
}

ipcMain.handle('get-data', () => loadData());
ipcMain.handle('get-current-config', () => {
    return { path: currentConfigPath, data: currentConfigPath ? loadConfig(currentConfigPath) : {} };
});
ipcMain.handle('save-config', (event, { confPath, confData }) => {
    try {
        fs.writeFileSync(confPath, JSON.stringify(confData, null, 2), 'utf8');
        // Reload all main mascot windows
        BrowserWindow.getAllWindows().forEach(w => {
            if (w !== dashboardWin && w !== editorWin) w.reload();
        });
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// --- 3. DYNAMIC RIGHT-CLICK MENU ---

ipcMain.on('show-context-menu', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const availableConfigs = scanConfigs();

  // Build the menu items dynamically
  const menuTemplate = [
    { label: 'Select Character:', enabled: false }, // Header
    { type: 'separator' }
  ];

  // Add an item for each JSON file found
  availableConfigs.forEach(conf => {
    menuTemplate.push({
      label: conf.name, // The "name" field from JSON
      type: 'radio',    // Shows a checkmark next to active one
      checked: conf.path === currentConfigPath,
      click: () => {
        // Update global variable and reload window
        currentConfigPath = conf.path;
        win.reload();
      }
    });
  });

  menuTemplate.push(
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => openDashboard() },
    { label: 'Edit Dialogues', click: () => openEditor() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  );

  const menu = Menu.buildFromTemplate(menuTemplate);
  menu.popup({ window: win });
});

// --- 4. DRAG LOGIC ---
let dragOffset = { x: 0, y: 0 };

ipcMain.on('drag-start', (event, cursor) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const winPos = win.getPosition();
  dragOffset = { x: cursor.x - winPos[0], y: cursor.y - winPos[1] };
});

ipcMain.on('drag-move', (event, cursor) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const newX = cursor.x - dragOffset.x;
  const newY = cursor.y - dragOffset.y;
  win.setPosition(Math.round(newX), Math.round(newY));
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});