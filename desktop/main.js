/**
 * Compress-It Desktop — Main Process
 * Electron main process that handles window creation and native compression
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");

// Set FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 700,
    minHeight: 550,
    title: "Compress-It",
    icon: path.join(__dirname, "renderer", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: "hiddenInset",
    frame: process.platform === "darwin" ? false : true,
    backgroundColor: "#f5f7fa",
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Remove menu bar on Windows/Linux
  if (process.platform !== "darwin") {
    mainWindow.setMenuBarVisibility(false);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// =============================================================================
// IPC Handlers — Image Compression
// =============================================================================

ipcMain.handle("compress-image", async (event, { filePath, options }) => {
  try {
    const inputBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let pipeline = sharp(inputBuffer);
    const metadata = await pipeline.metadata();

    // Resize if requested
    if (options.resizeWidth || options.resizeHeight) {
      pipeline = pipeline.resize(
        options.resizeWidth || null,
        options.resizeHeight || null,
        { fit: "inside", withoutEnlargement: true },
      );
    }

    // Determine output format
    let outputFormat = options.outputFormat || "original";
    if (outputFormat === "original") {
      const formatMap = {
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".png": "png",
        ".gif": "gif",
        ".webp": "webp",
      };
      outputFormat = formatMap[ext] || "jpeg";
    }

    // Apply compression
    const quality = options.quality || 80;
    switch (outputFormat) {
      case "jpeg":
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case "png":
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality });
        break;
      case "gif":
        pipeline = pipeline.gif();
        break;
    }

    const outputBuffer = await pipeline.toBuffer();

    // Determine output extension
    const extMap = { jpeg: ".jpg", png: ".png", webp: ".webp", gif: ".gif" };
    const outExt = extMap[outputFormat] || ext;
    const outName = fileName.replace(/\.[^.]+$/, outExt);

    return {
      success: true,
      originalName: fileName,
      outputName: outName,
      originalSize: inputBuffer.length,
      compressedSize: outputBuffer.length,
      compressedData: outputBuffer.toString("base64"),
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =============================================================================
// IPC Handlers — Video Compression
// =============================================================================

ipcMain.handle("get-video-info", async (event, filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        resolve({ success: false, error: err.message });
        return;
      }
      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
      );
      const audioStream = metadata.streams.find(
        (s) => s.codec_type === "audio",
      );
      resolve({
        success: true,
        duration: metadata.format.duration,
        size: metadata.format.size,
        width: videoStream?.width,
        height: videoStream?.height,
        fps: videoStream ? eval(videoStream.r_frame_rate) : 30,
        videoCodec: videoStream?.codec_name,
        audioCodec: audioStream?.codec_name,
        bitrate: metadata.format.bit_rate,
      });
    });
  });
});

// Active FFmpeg processes for cancellation
const activeProcesses = new Map();

ipcMain.handle(
  "compress-video",
  async (event, { filePath, outputPath, options }) => {
    return new Promise((resolve) => {
      const targetSizeBytes = options.targetSizeMB * 1024 * 1024;
      const audioBitrate = 128;

      // Get video info first
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          resolve({ success: false, error: err.message });
          return;
        }

        const duration = metadata.format.duration;
        const targetTotalBitrate = (targetSizeBytes * 8) / duration / 1000;
        const videoBitrate = Math.max(
          100,
          Math.floor(targetTotalBitrate - audioBitrate),
        );

        const presetMap = {
          high: { preset: "slow", crf: 20 },
          medium: { preset: "medium", crf: 23 },
          low: { preset: "fast", crf: 28 },
        };
        const { preset, crf } = presetMap[options.quality || "medium"];

        // Scale settings
        const fileSizeMB = metadata.format.size / (1024 * 1024);
        const compressionRatio = options.targetSizeMB / fileSizeMB;
        let scaleFilter = null;
        if (compressionRatio < 0.15) {
          scaleFilter = "scale=-2:480";
        } else if (compressionRatio < 0.35) {
          scaleFilter = "scale=-2:720";
        }

        let command = ffmpeg(filePath)
          .videoCodec("libx264")
          .addOption("-preset", preset)
          .addOption("-crf", crf.toString())
          .addOption("-maxrate", `${videoBitrate}k`)
          .addOption("-bufsize", `${videoBitrate * 2}k`)
          .audioCodec("aac")
          .audioBitrate(`${audioBitrate}k`)
          .addOption("-movflags", "+faststart")
          .addOption("-threads", "0")
          .output(outputPath)
          .on("progress", (progress) => {
            const percent = Math.min(Math.round(progress.percent || 0), 99);
            mainWindow.webContents.send("video-progress", {
              percent,
              timemark: progress.timemark,
              speed: progress.currentFps
                ? `${progress.currentFps} fps`
                : "calculating...",
            });
          })
          .on("end", () => {
            activeProcesses.delete(filePath);
            const stats = fs.statSync(outputPath);
            resolve({
              success: true,
              outputPath,
              originalSize: metadata.format.size,
              compressedSize: stats.size,
            });
          })
          .on("error", (err) => {
            activeProcesses.delete(filePath);
            if (
              err.message.includes("SIGKILL") ||
              err.message.includes("killed")
            ) {
              resolve({ success: false, cancelled: true });
            } else {
              resolve({ success: false, error: err.message });
            }
          });

        // Add scale filter
        if (scaleFilter) {
          command = command.videoFilter(scaleFilter);
        }

        // WebM output
        if (options.outputFormat === "webm") {
          command = ffmpeg(filePath)
            .videoCodec("libvpx-vp9")
            .addOption("-crf", crf.toString())
            .addOption("-b:v", `${videoBitrate}k`)
            .addOption("-deadline", "good")
            .addOption("-cpu-used", "4")
            .addOption("-row-mt", "1")
            .addOption("-threads", "0")
            .audioCodec("libopus")
            .audioBitrate(`${audioBitrate}k`)
            .output(outputPath)
            .on("progress", (progress) => {
              const percent = Math.min(Math.round(progress.percent || 0), 99);
              mainWindow.webContents.send("video-progress", {
                percent,
                timemark: progress.timemark,
                speed: progress.currentFps
                  ? `${progress.currentFps} fps`
                  : "calculating...",
              });
            })
            .on("end", () => {
              activeProcesses.delete(filePath);
              const stats = fs.statSync(outputPath);
              resolve({
                success: true,
                outputPath,
                originalSize: metadata.format.size,
                compressedSize: stats.size,
              });
            })
            .on("error", (err) => {
              activeProcesses.delete(filePath);
              if (
                err.message.includes("SIGKILL") ||
                err.message.includes("killed")
              ) {
                resolve({ success: false, cancelled: true });
              } else {
                resolve({ success: false, error: err.message });
              }
            });

          if (scaleFilter) {
            command = command.videoFilter(scaleFilter);
          }
        }

        // Store for cancellation
        activeProcesses.set(filePath, command);
        command.run();
      });
    });
  },
);

ipcMain.handle("cancel-video", async (event, filePath) => {
  const process = activeProcesses.get(filePath);
  if (process) {
    process.kill("SIGKILL");
    activeProcesses.delete(filePath);
    return { success: true };
  }
  return { success: false };
});

// =============================================================================
// IPC Handlers — File System
// =============================================================================

ipcMain.handle("select-files", async (event, type) => {
  const filters =
    type === "video"
      ? [{ name: "Videos", extensions: ["mp4", "mov", "avi", "mkv", "webm"] }]
      : [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }];

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
    filters,
  });

  if (result.canceled) return [];

  return result.filePaths.map((fp) => ({
    path: fp,
    name: path.basename(fp),
    size: fs.statSync(fp).size,
  }));
});

ipcMain.handle("select-save-path", async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: "MP4 Video", extensions: ["mp4"] },
      { name: "WebM Video", extensions: ["webm"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle("save-file", async (event, { data, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
  });

  if (result.canceled) return { success: false };

  const buffer = Buffer.from(data, "base64");
  fs.writeFileSync(result.filePath, buffer);
  return { success: true, path: result.filePath };
});

ipcMain.handle("save-file-direct", async (event, { data, filePath }) => {
  try {
    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-path", async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle("get-temp-path", () => {
  return app.getPath("temp");
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});
