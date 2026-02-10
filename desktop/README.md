# Compress-It Desktop

> Blazing fast image & video compression — 10-20x faster than browser-based tools. Smarter than HandBrake, easier to use, 100% private.

## Why Compress-It Desktop?

| Feature | Compress-It Desktop | HandBrake | Online Tools |
|---------|:------------------:|:---------:|:------------:|
| **Speed** | ⚡ Native FFmpeg | ⚡ Fast | 🐌 Slow (WASM) |
| **Image Compression** | ✅ Built-in | ❌ No | ⚠️ Some |
| **Video Compression** | ✅ One-click | ⚠️ Complex | ⚠️ Slow |
| **WhatsApp/Discord presets** | ✅ Built-in | ❌ Manual | ❌ No |
| **Simple UI** | ✅ Drag & drop | ❌ 50+ options | ✅ Simple |
| **Privacy** | ✅ 100% offline | ✅ Offline | ❌ Uploads files |
| **Batch processing** | ✅ Unlimited | ⚠️ Queue-based | ⚠️ Limited |
| **No installation** | ✅ Portable option | ❌ Installer | ✅ Browser |

## Quick Start

### Run from source

```bash
cd desktop
npm install
npm start
```

### Build installer

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# All platforms
npm run build:all
```

The built installers will be in `desktop/dist/`.

## Features

### 🖼️ Image Compression
- **Formats**: JPG, PNG, GIF, WebP
- **Quality slider**: Fine-tune compression 1-100%
- **Format conversion**: Convert between any format
- **Batch mode**: Compress hundreds of images at once
- **Powered by Sharp** — the fastest Node.js image processor

### 🎬 Video Compression
- **Formats**: MP4, MOV, AVI, MKV, WebM
- **Smart presets**: WhatsApp (180MB), Discord (16MB), Email (25MB)
- **Quality options**: Best Quality, Balanced, Fastest
- **Native FFmpeg**: 10-20x faster than browser-based compression
- **Progress tracking**: Real-time speed, ETA, and percentage
- **Cancellable**: Stop any time without corruption

### 🔒 Privacy
- Everything runs on your computer
- No internet required
- No data is ever sent anywhere
- No accounts, no tracking, no analytics

## Tech Stack

- **Electron** — Cross-platform desktop framework
- **Sharp** — High-performance image processing
- **FFmpeg** (bundled) — Industry-standard video processing
- **Zero config** — Works out of the box, no setup needed
