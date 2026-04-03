const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');
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
  const dir = path.join(getRootDir(), 'configs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
  return readJson(filePath, {
    img_size: { width: 100, height: 100 },
    img_path: "img.png",
    dialogue: ["Error loading config"]
  });
}

// --- 2. WINDOW CREATION ---

let mainWin = null;

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

  mainWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    //skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  if (process.platform === 'darwin') {
    mainWin.setAlwaysOnTop(true, 'floating');
    mainWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    mainWin.setAlwaysOnTop(true, 'screen-saver');
  }

  mainWin.loadFile(path.join(__dirname, 'index.html'));

  // When window loads, read the CURRENT config file and send it
  mainWin.webContents.on('did-finish-load', () => {
    if (!currentConfigPath) return;

    const freshConfig = loadConfig(currentConfigPath);

    // Resize window dynamically based on the new character's size
    const newWidth = (freshConfig.img_size.width || 100) + 200;
    const newHeight = (freshConfig.img_size.height || 100) + 150;
    mainWin.setSize(newWidth, newHeight);

    // Send data to renderer
    mainWin.webContents.send('init-data', { config: freshConfig, rootDir, configDir: path.dirname(currentConfigPath) });
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
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('show-quit-dialogue');
      setTimeout(() => {
        app.quit();
      }, 3000);
    } else {
      app.quit();
    }
  }
});

// --- DATA STORE HELPERS ---
const stopWordsFilePath = path.join(getRootDir(), 'configs', 'stopwords.json');

function readJson(filePath, defaultValue) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadStopWords() {
  return readJson(stopWordsFilePath, ["我", "你", "的", "了", "好"]);
}

function getDataFilePath(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return path.join(getRootDir(), 'data', `${year}-${month}.json`);
}

function loadDataForDate(date) {
  return readJson(getDataFilePath(date), { clicks: {}, inputs: [] });
}

function saveDataForDate(data, date) {
  const dir = path.join(getRootDir(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  writeJson(getDataFilePath(date), data);
}

function loadAllData() {
  const dataDir = path.join(getRootDir(), 'data');
  const merged = { clicks: {}, inputs: [] };
  if (!fs.existsSync(dataDir)) return merged;

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const d = readJson(path.join(dataDir, f), { clicks: {}, inputs: [] });
    // Merge clicks
    if (d.clicks) {
      Object.assign(merged.clicks, d.clicks);
    }
    // Merge inputs
    if (d.inputs) {
      merged.inputs = merged.inputs.concat(d.inputs);
    }
  }
  return merged;
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
  const date = new Date();
  const data = loadDataForDate(date);
  const hourKey = getLocalHourKey();
  data.clicks[hourKey] = (data.clicks[hourKey] || 0) + 1;
  saveDataForDate(data, date);
});

function getLocalTimeStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

ipcMain.on('user-input-saved', (event, text) => {
  const date = new Date();
  const data = loadDataForDate(date);
  data.inputs.push({ time: getLocalTimeStr(), text });
  saveDataForDate(data, date);
});

// --- DASHBOARD & EDITOR WINDOWS ---
function createPanelWindow(file) {
  const win = new BrowserWindow({
    width: 600, height: 650,
    frame: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  win.loadFile(path.join(__dirname, file));
  return win;
}

let dashboardWin = null;
function openDashboard() {
  if (dashboardWin) { dashboardWin.focus(); return; }
  dashboardWin = createPanelWindow('dashboard.html');
  dashboardWin.on('closed', () => { dashboardWin = null; });
}

let editorWin = null;
function openEditor() {
  if (editorWin) { editorWin.focus(); return; }
  editorWin = createPanelWindow('editor.html');
  editorWin.on('closed', () => { editorWin = null; });
}

ipcMain.handle('get-data', () => loadAllData());
ipcMain.handle('get-stopwords', () => loadStopWords());
ipcMain.handle('save-stopwords', (event, list) => {
  try {
    writeJson(stopWordsFilePath, list);
    return true;
  } catch (e) { return false; }
});
ipcMain.handle('get-current-config', () => {
  return { path: currentConfigPath, data: currentConfigPath ? loadConfig(currentConfigPath) : {} };
});
ipcMain.handle('save-config', (event, { confPath, confData }) => {
  try {
    writeJson(confPath, confData);
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
        currentConfigPath = conf.path;
        mainWin.reload();
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
  menu.popup({ window: mainWin });
});

// --- 4. DRAG LOGIC ---
ipcMain.on('drag-move', (event, delta) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + delta.x), Math.round(y + delta.y), false);
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});