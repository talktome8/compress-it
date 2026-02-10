/**
 * Compress-It Desktop — Preload Script
 * Secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("compressIt", {
  // Image compression
  compressImage: (filePath, options) =>
    ipcRenderer.invoke("compress-image", { filePath, options }),

  // Video compression
  getVideoInfo: (filePath) => ipcRenderer.invoke("get-video-info", filePath),
  compressVideo: (filePath, outputPath, options) =>
    ipcRenderer.invoke("compress-video", { filePath, outputPath, options }),
  cancelVideo: (filePath) => ipcRenderer.invoke("cancel-video", filePath),
  onVideoProgress: (callback) => {
    ipcRenderer.on("video-progress", (event, data) => callback(data));
  },

  // File system
  selectFiles: (type) => ipcRenderer.invoke("select-files", type),
  selectSavePath: (defaultName) =>
    ipcRenderer.invoke("select-save-path", defaultName),
  saveFile: (data, defaultName) =>
    ipcRenderer.invoke("save-file", { data, defaultName }),
  saveFileDirect: (data, filePath) =>
    ipcRenderer.invoke("save-file-direct", { data, filePath }),
  openPath: (filePath) => ipcRenderer.invoke("open-path", filePath),
  getTempPath: () => ipcRenderer.invoke("get-temp-path"),

  // App info
  getVersion: () => ipcRenderer.invoke("get-app-version"),
  platform: process.platform,
});
