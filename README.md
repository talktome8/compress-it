# Compress-It 🖼️

A fast, free, and private image compression web application. Compress JPG, PNG, GIF, and WebP images with adjustable quality settings, real-time previews, and batch downloads.

![Compress-It Screenshot](docs/screenshot.png)

## ✨ Features

- **Multiple Format Support**: JPG, PNG, GIF, WebP
- **Batch Processing**: Upload and compress up to 20 images at once
- **Adjustable Quality**: Fine-tune compression with a quality slider (1-100%)
- **Format Conversion**: Convert between image formats (including WebP for best compression)
- **Optional Resize**: Resize images while compressing
- **Real-time Previews**: Side-by-side comparison of original vs compressed
- **Individual Downloads**: Download compressed images one at a time
- **Bulk ZIP Download**: Download all compressed images in a single ZIP file
- **Drag & Drop**: Easy file upload with drag-and-drop support
- **Privacy First**: Images are automatically deleted after 30 minutes
- **Responsive Design**: Works on desktop, tablet, and mobile

## 🛠️ Technology Stack

### Backend
- **Node.js** + **Express**: Fast, non-blocking server
- **Sharp**: High-performance image processing built on libvips
- **Multer**: Efficient file upload handling
- **Archiver**: ZIP file creation for bulk downloads

### Frontend
- **Vanilla JavaScript**: No framework overhead, minimal bundle size
- **Modern CSS**: CSS Variables, Flexbox, Grid, responsive design
- **Native Drag & Drop API**: Browser-native file handling

## 📊 Why These Technology Choices?

### Sharp over ImageMagick/GraphicsMagick

| Feature | Sharp | ImageMagick |
|---------|-------|-------------|
| Speed | 4-8x faster | Baseline |
| Memory | Streaming, low memory | High memory usage |
| Installation | npm install | System dependency |
| Node.js Integration | Native | Child process |

Sharp uses **libvips**, which:
- Processes images in streaming mode (low memory footprint)
- Uses parallel processing for multi-core CPUs
- Supports lazy evaluation (only processes what's needed)
- Includes optimized codecs (MozJPEG for JPEG, pngquant-style for PNG)

### Server-Side vs Client-Side Processing

**We chose server-side processing because:**

| Aspect | Server-Side (Our Choice) | Client-Side (WebAssembly) |
|--------|--------------------------|---------------------------|
| Compression Quality | Professional-grade (MozJPEG, pngquant) | Limited to browser APIs |
| Processing Speed | Faster (native code) | Slower (WASM overhead) |
| File Size Limits | Higher (50MB+) | Browser memory constrained |
| Browser Support | Universal | Requires modern browsers |
| Privacy Trade-off | Files sent to server | Fully client-side |

**Trade-off**: Files are temporarily uploaded, but we mitigate privacy concerns with:
- Automatic deletion after 30 minutes
- No file storage or logging
- Unique random filenames
- No third-party services

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** or **yarn**

### Installation

1. **Clone or download the repository**
   ```bash
   cd compress-it
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### VS Code Setup

1. Open the project folder in VS Code
2. Install recommended extensions (VS Code will prompt you)
3. Press `F5` to start debugging, or use:
   - `Ctrl+Shift+B` → "Start Development Server"
   - Run & Debug panel → "Start Server" or "Full Stack Debug"

## 📁 Project Structure

```
compress-it/
├── public/                 # Static frontend files
│   ├── index.html         # Main HTML page
│   ├── css/
│   │   └── styles.css     # All styles
│   └── js/
│       └── app.js         # Frontend JavaScript
├── server/                 # Backend server
│   ├── index.js           # Express app entry point
│   ├── routes/
│   │   └── compression.js # API routes
│   └── services/
│       └── compressionService.js # Image processing logic
├── uploads/               # Temporary uploaded files (auto-cleaned)
├── compressed/            # Temporary compressed files (auto-cleaned)
├── .vscode/              # VS Code configuration
│   ├── launch.json       # Debug configurations
│   ├── tasks.json        # Build tasks
│   ├── settings.json     # Editor settings
│   └── extensions.json   # Recommended extensions
├── package.json          # Dependencies and scripts
├── .gitignore           # Git ignore rules
├── .env.example         # Environment variables template
└── README.md            # This file
```

## 🔧 Configuration

Copy `.env.example` to `.env` and customize:

```env
NODE_ENV=development
PORT=3000
MAX_FILE_SIZE=52428800    # 50MB in bytes
MAX_FILES=20              # Max files per upload
DEFAULT_QUALITY=80        # Default compression quality
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload images (multipart form) |
| POST | `/api/compress` | Compress uploaded images |
| GET | `/api/download/:filename` | Download single image |
| POST | `/api/download-zip` | Download multiple as ZIP |
| GET | `/api/preview/:filename` | Get compressed image preview |
| DELETE | `/api/cleanup` | Clean up session files |
| GET | `/api/health` | Health check |

## 🚀 Deployment

### Option 1: Render (Recommended - Free Tier)

1. Push code to GitHub
2. Create account at [render.com](https://render.com)
3. New → Web Service → Connect repository
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
5. Add environment variables (PORT will be set automatically)

### Option 2: Railway

1. Push code to GitHub
2. Create account at [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Railway auto-detects Node.js and deploys

### Option 3: DigitalOcean App Platform

1. Push code to GitHub
2. Create app at [cloud.digitalocean.com](https://cloud.digitalocean.com)
3. Choose repository and branch
4. Configure as Web Service with Node.js

### Option 4: VPS (Ubuntu)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone <your-repo>
cd compress-it
npm install --production

# Install PM2 for process management
sudo npm install -g pm2
pm2 start server/index.js --name compress-it
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt install nginx
# Configure /etc/nginx/sites-available/compress-it
```

### Option 5: Docker

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

Build and run:
```bash
docker build -t compress-it .
docker run -p 3000:3000 compress-it
```

## 📈 Performance Optimization Tips

### Server-Side
1. **Enable gzip/brotli** compression in production (nginx/cloudflare)
2. **Use CDN** for static assets
3. **Increase Node.js memory** for large batches: `node --max-old-space-size=2048`
4. **Use Redis** for session storage in multi-instance deployments
5. **Configure Sharp concurrency**: `sharp.concurrency(2)` for limited memory environments

### Frontend
1. **Lazy load** preview images
2. **Use WebP** format for maximum compression
3. **Preconnect** to API server
4. **Service Worker** for offline support (future enhancement)

## 🔄 Comparison with Existing Tools

| Feature | Compress-It | TinyPNG | Squoosh | Compressor.io |
|---------|-------------|---------|---------|---------------|
| Free | ✅ Unlimited | 500/month | ✅ | ✅ Limited |
| Batch Upload | ✅ 20 files | ✅ 20 files | ❌ 1 file | ✅ |
| Formats | JPG, PNG, GIF, WebP | PNG, JPG, WebP | Many | JPG, PNG, GIF, SVG |
| Quality Control | ✅ Slider | ❌ Auto only | ✅ Detailed | ✅ |
| Resize | ✅ | ❌ | ✅ | ✅ |
| Privacy | Self-hosted option | Cloud only | Client-side | Cloud only |
| Speed | Very Fast (Sharp) | Fast | Medium (WASM) | Fast |
| Offline | Self-hosted | ❌ | ✅ (PWA) | ❌ |
| Open Source | ✅ | ❌ | ✅ | ❌ |

### Our Advantages
1. **Self-hostable**: Full control over your data
2. **No limits**: No monthly quotas or file count limits
3. **Quality control**: Fine-tune compression level
4. **Fast processing**: Sharp/libvips is industry-leading
5. **Modern stack**: Easy to customize and extend

## 🔒 Security Considerations

- Files are stored with random UUIDs (not original names)
- Automatic cleanup after 30 minutes
- File type validation on both client and server
- File size limits (50MB default)
- No persistent storage or logging of image content
- CORS configured for same-origin by default

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - feel free to use in personal or commercial projects.

## 🙏 Acknowledgments

- [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [libvips](https://www.libvips.org/) - The engine behind Sharp
- [Archiver](https://www.archiverjs.com/) - ZIP file generation
- [Inter Font](https://rsms.me/inter/) - Beautiful UI typography

---

Made with ❤️ for fast, free image compression
