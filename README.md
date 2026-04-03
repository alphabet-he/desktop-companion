# Desktop Companion

A fully customizable desktop mascot for macOS and Windows. This interactive companion stays on top of your windows, responds to your clicks, and tracks your daily interactions through a beautiful glassmorphism dashboard.

https://github.com/user-attachments/assets/3780fdf3-ff24-43d9-aaa8-71cc457acbd4

## 🌟 For Users

### 🎮 How to Use
- **Interaction**: Click the mascot for a random dialogue, or hover over it to reveal a text input for chatting.
- **Draggable**: Click and drag the mascot to move it anywhere on your screen. It always stays on top of other windows.
- **Data Dashboard**: Opens via the right-click menu. View your interaction trends, click hotspots, and a word cloud of your recent chats.
- **Dialogue Editor**: Opens via the right-click menu. Customize the dialogues for your current companion across categories like Startup, Idle, and Quit.

### ⚙️ Customization
You can deeply customize each companion by editing their `.json` file in the `configs/` folder. Here's a breakdown of the available fields:

#### 🟢 Core Configuration
- **`name`**: The display name of your companion (shown in the right-click menu).
- **`img_path`**: Filename of the mascot image (e.g., `cat.png`). Must be in the `configs/` folder.
- **`img_size`**: The display size of the mascot: `{"width": 150, "height": 150}`.
- **`input_placeholder`**: The text shown in the chat box when empty (e.g., "Say meow...").

#### 💬 Dialogue Categories
The mascot uses different lists of dialogues based on the situation:
- **`dialogue`**: General random dialogues triggered by clicking the mascot or after you send a message.
- **`dialogue_startup`**: Greets you when the application first launches.
- **`dialogue_idle`**: Dialogues that trigger randomly when the mascot has been ignored for a while.
- **`dialogue_quit`**: A final message shown for 3 seconds before the app closes.

#### 🎨 Panel Styling
You can customize the look of the **Dialogue Editor** and **Data Dashboard** separately:
- **`panel_bg_color`**: The background color of the panel (Hex code).
- **`panel_bg_image`**: An optional background image (e.g., `fish.png`).
- **`panel_bg_image_size`**: Controls the background image scaling (`width`/`height`).

---

### 👥 Adding Multiple Companions
Want more friends? Simply drop a new `.json` configuration file and its corresponding image into the `configs/` folder. The app will automatically detect it, and you can switch to it via the right-click menu.

---

## 🛠️ For Developers

### 🏗️ Getting Started
1. **Clone & Install**:
   ```bash
   git clone <repository-url>
   cd desktop-companion
   npm install
   ```
2. **Development Mode**:
   ```bash
   npm start
   ```
3. **Build & Package**:
   - **macOS**: `npm run build:mac`
   - **Windows**: `npm run build:win`
   - **Both**: `npm run build`

### 📂 Project Structure
- **`src/index.js`**: The heart of the app (Main process). Manages window creation, tray menus, and data persistence.
- **`src/*.html`**: Renderer processes for the Mascot, Dashboard, and Editor interfaces.
- **`src/configs/`**: Where your character configurations and image assets live.
- **`src/data/`**: User interaction logs, organized by character name and month.
- **`scripts/postbuild.js`**: Ensures configuration templates are correctly packaged into the final distribution.

---

*0% handwritten codes; 100% built by AI* 🐾
