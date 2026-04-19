# 🖥️ Desktop App Setup Guide

## Two Options

### Option 1: Run from Source (Easiest)
No download needed! Run directly from your clone:

```bash
# Navigate to desktop folder
cd desktop

# Install dependencies (first time only)
npm install

# Run the app
npm start
```

### Option 2: Download Binary (Coming Soon)
We'll create a packaged release. For now, use Option 1.

## 📦 Creating Desktop App Releases

### For You (Maintainer):

#### Step 1: Install Electron Builder
```bash
cd desktop
npm install --save-dev electron-builder
```

#### Step 2: Update desktop/package.json
Add build configuration:
```json
{
  "name": "compress-it",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "build": {
    "appId": "com.compressit.app",
    "productName": "Compress-It",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "renderer/assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "renderer/assets/icon.icns"
    },
    "linux": {
      "target": "AppImage",
      "icon": "renderer/assets/icon.png"
    }
  }
}
```

#### Step 3: Build Executables
```bash
# Build for Windows
npm run build:win

# Build for Mac
npm run build:mac

# Build for Linux
npm run build:linux

# Or build for all platforms
npm run build
```

Output will be in `desktop/dist/`

#### Step 4: Create GitHub Release
1. Go to https://github.com/talktome8/compress-it/releases
2. Click **"Create a new release"**
3. Tag: `v1.0.0`
4. Title: `Compress-It Desktop v1.0.0`
5. Description:
   ```markdown
   ## Desktop App - No File Size Limits!
   
   ### Features
   - ✅ Compress images of any size
   - ✅ Works offline
   - ✅ Faster processing
   - ✅ No upload to server
   - ✅ Supports JPG, PNG, GIF, WebP
   
   ### Downloads
   - **Windows**: Compress-It-Setup-1.0.0.exe
   - **macOS**: Compress-It-1.0.0.dmg
   - **Linux**: Compress-It-1.0.0.AppImage
   
   ### Installation
   1. Download the file for your OS
   2. Run the installer
   3. Done!
   ```
6. Upload files from `desktop/dist/`
7. Click **"Publish release"**

## 👥 For Users

### Windows
1. Download `Compress-It-Setup-1.0.0.exe`
2. Double-click to install
3. Find "Compress-It" in Start Menu

### macOS
1. Download `Compress-It-1.0.0.dmg`
2. Open DMG file
3. Drag app to Applications folder

### Linux
1. Download `Compress-It-1.0.0.AppImage`
2. Make executable: `chmod +x Compress-It-1.0.0.AppImage`
3. Run: `./Compress-It-1.0.0.AppImage`

## 🎯 Quick Start (Run from Source)

If you just want to use it now without building:

```bash
# 1. Clone repository
git clone https://github.com/talktome8/compress-it.git
cd compress-it/desktop

# 2. Install dependencies
npm install

# 3. Run app
npm start
```

## 🔧 Development

### File Structure
```
desktop/
├── main.js          # Electron main process
├── preload.js       # Secure bridge
├── package.json     # Dependencies
└── renderer/        # UI
    ├── index.html   # Interface
    ├── js/
    │   └── app.js   # Logic
    └── css/
        └── styles.css
```

### Adding Features
1. Edit files in `desktop/renderer/`
2. Test with `npm start`
3. Rebuild with `npm run build`

## 📊 Desktop vs Web

| Feature | Web App | Desktop App |
|---------|---------|-------------|
| **File Size** | 4MB (Vercel)<br>50MB (Render) | ✅ **Unlimited** |
| **Speed** | Server processing | ✅ **Local (faster)** |
| **Privacy** | Files uploaded | ✅ **100% local** |
| **Offline** | ❌ Requires internet | ✅ **Works offline** |
| **Updates** | Automatic | Manual download |

## 🎁 Benefits of Desktop App

### For Users:
- ✅ No file size limits
- ✅ No internet required
- ✅ Faster processing
- ✅ Private (no uploads)
- ✅ Batch processing
- ✅ No 413 errors!

### For You:
- ✅ No server costs
- ✅ No bandwidth limits
- ✅ Users can work offline
- ✅ Better performance

## 🚀 Distribution Options

### Option 1: GitHub Releases (Free)
- Host on GitHub
- Users download directly
- Easy updates

### Option 2: Microsoft Store (Windows)
- Wider reach
- Automatic updates
- Costs $19 one-time

### Option 3: Mac App Store (macOS)
- Wider reach
- Automatic updates
- Requires Apple Developer ($99/year)

### Option 4: Snap Store (Linux)
- Free
- Automatic updates
- Easy distribution

## 📝 Release Checklist

- [ ] Add app icons (renderer/assets/)
- [ ] Update version in package.json
- [ ] Test on Windows
- [ ] Test on macOS (if available)
- [ ] Test on Linux (if available)
- [ ] Build executables
- [ ] Create GitHub release
- [ ] Upload binaries
- [ ] Test downloads
- [ ] Update README with download links

## 🔗 Quick Links for Users

After creating release, add to README:

```markdown
## 📥 Download Desktop App

### No File Size Limits! 🚀

- [Windows (EXE)](https://github.com/talktome8/compress-it/releases/latest/download/Compress-It-Setup-1.0.0.exe)
- [macOS (DMG)](https://github.com/talktome8/compress-it/releases/latest/download/Compress-It-1.0.0.dmg)
- [Linux (AppImage)](https://github.com/talktome8/compress-it/releases/latest/download/Compress-It-1.0.0.AppImage)
```

---

**For now, users can run from source using Option 1 above!**
**Creating packaged releases is optional but recommended for easier distribution.**
