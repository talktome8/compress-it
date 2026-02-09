/**
 * Compress-It — Video Compression Module
 * Uses FFmpeg.wasm for 100% client-side video compression
 * No video data is ever sent to a server
 */

// =============================================================================
// State & Config
// =============================================================================

const videoState = {
  file: null,
  compressedBlob: null,
  compressedFileName: null,
  ffmpeg: null,
  isLoading: false,
  isCompressing: false,
  startTime: null,
};

const FFMPEG_CORE_URL =
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js";
const FFMPEG_WASM_URL =
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm";

// =============================================================================
// Tab Switching
// =============================================================================

function switchTab(tab) {
  const imageMode = document.getElementById("imageMode");
  const videoMode = document.getElementById("videoMode");
  const tabImages = document.getElementById("tabImages");
  const tabVideos = document.getElementById("tabVideos");

  if (tab === "images") {
    imageMode.style.display = "";
    videoMode.style.display = "none";
    tabImages.classList.add("active");
    tabVideos.classList.remove("active");
  } else {
    imageMode.style.display = "none";
    videoMode.style.display = "";
    tabImages.classList.remove("active");
    tabVideos.classList.add("active");
  }
}

// =============================================================================
// FFmpeg Loading
// =============================================================================

async function loadFFmpeg() {
  if (videoState.ffmpeg) return videoState.ffmpeg;
  if (videoState.isLoading) return null;

  videoState.isLoading = true;
  showVideoProgress(
    "Loading video engine...",
    "This is a one-time ~30MB download",
  );

  try {
    // Dynamically import FFmpeg
    const { FFmpeg } = await import(
      "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js"
    );
    const { toBlobURL } = await import(
      "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js"
    );

    const ffmpeg = new FFmpeg();

    // Progress callback for loading
    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    ffmpeg.on("progress", ({ progress, time }) => {
      if (videoState.isCompressing && videoState.startTime) {
        const percent = Math.min(Math.round(progress * 100), 99);
        const elapsed = (Date.now() - videoState.startTime) / 1000;
        const estimated = progress > 0 ? elapsed / progress : 0;
        const remaining = Math.max(0, estimated - elapsed);
        const eta = formatTime(remaining);

        updateVideoProgress(
          percent,
          `Compressing... ${percent}%`,
          `ETA: ${eta}`,
        );
      }
    });

    // Load FFmpeg core with CORS-friendly URLs
    const coreURL = await toBlobURL(FFMPEG_CORE_URL, "text/javascript");
    const wasmURL = await toBlobURL(FFMPEG_WASM_URL, "application/wasm");

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    videoState.ffmpeg = ffmpeg;
    videoState.isLoading = false;
    return ffmpeg;
  } catch (error) {
    videoState.isLoading = false;
    console.error("FFmpeg load error:", error);
    throw new Error(
      "Failed to load video engine. Please use a modern browser (Chrome, Edge, or Firefox).",
    );
  }
}

// =============================================================================
// Video File Handling
// =============================================================================

function handleVideoFile(file) {
  const validTypes = [
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-msvideo",
    "video/x-matroska",
  ];

  // Also check extension for types browsers may not recognize
  const ext = file.name.split(".").pop().toLowerCase();
  const validExts = ["mp4", "mov", "webm", "avi", "mkv"];

  if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
    showToast("Unsupported video format", "error");
    return;
  }

  videoState.file = file;

  // Show settings
  document.getElementById("videoSettingsSection").style.display = "";

  // Update file info
  document.getElementById("videoFileName").textContent = file.name;
  document.getElementById("videoFileSize").textContent = formatFileSize(
    file.size,
  );

  // Get video metadata (duration, resolution)
  const video = document.createElement("video");
  video.preload = "metadata";
  video.onloadedmetadata = () => {
    const duration = video.duration;
    const width = video.videoWidth;
    const height = video.videoHeight;

    document.getElementById("videoFileDuration").textContent =
      formatTime(duration);
    document.getElementById(
      "videoFileResolution",
    ).textContent = `${width}×${height}`;

    URL.revokeObjectURL(video.src);
  };
  video.src = URL.createObjectURL(file);
}

function clearVideo() {
  videoState.file = null;
  videoState.compressedBlob = null;
  document.getElementById("videoSettingsSection").style.display = "none";
  document.getElementById("videoResultSection").style.display = "none";
  document.getElementById("videoProgressSection").style.display = "none";
}

function resetVideo() {
  clearVideo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =============================================================================
// Video Compression
// =============================================================================

async function startVideoCompression() {
  if (!videoState.file || videoState.isCompressing) return;

  videoState.isCompressing = true;
  const compressBtn = document.getElementById("videoCompressBtn");
  compressBtn.disabled = true;

  try {
    // Load FFmpeg if not loaded
    const ffmpeg = await loadFFmpeg();
    if (!ffmpeg) throw new Error("FFmpeg not available");

    // Get settings
    const targetSizeSelect = document.getElementById("videoTargetSize");
    let targetSizeMB;
    if (targetSizeSelect.value === "custom") {
      targetSizeMB = parseInt(document.getElementById("videoCustomSize").value);
      if (!targetSizeMB || targetSizeMB < 1) {
        throw new Error("Please enter a valid target size");
      }
    } else {
      targetSizeMB = parseInt(targetSizeSelect.value);
    }

    const qualityPreset = document.getElementById("videoQualityPreset").value;
    const outputFormat = document.getElementById("videoOutputFormat").value;

    // Check if compression is needed
    const fileSizeMB = videoState.file.size / (1024 * 1024);
    if (fileSizeMB <= targetSizeMB) {
      showToast(
        `Your video is already ${formatFileSize(
          videoState.file.size,
        )} — under the ${targetSizeMB}MB target!`,
        "success",
      );
      videoState.isCompressing = false;
      compressBtn.disabled = false;
      return;
    }

    showVideoProgress("Preparing video...", "Reading file into memory");
    document.getElementById("videoCancelBtn").style.display = "";

    // Write input file to FFmpeg virtual filesystem
    const fileData = await readFileAsArrayBuffer(videoState.file);
    const inputName = "input" + getFileExtension(videoState.file.name);
    const outputName = `output.${outputFormat}`;

    await ffmpeg.writeFile(inputName, new Uint8Array(fileData));

    // Get video duration for bitrate calculation
    const duration = await getVideoDuration(videoState.file);

    // Calculate target bitrate
    const targetSizeBytes = targetSizeMB * 1024 * 1024;
    const audioBitrate = 128; // kbps
    const targetTotalBitrate = (targetSizeBytes * 8) / duration / 1000; // kbps
    let videoBitrate = Math.max(
      100,
      Math.floor(targetTotalBitrate - audioBitrate),
    );

    // Apply quality preset modifier
    const presetMap = {
      high: { preset: "slow", crf: 23 },
      medium: { preset: "medium", crf: 28 },
      low: { preset: "fast", crf: 32 },
    };
    const { preset, crf } = presetMap[qualityPreset];

    // Build FFmpeg command
    let args;
    if (outputFormat === "mp4") {
      args = [
        "-i",
        inputName,
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        crf.toString(),
        "-maxrate",
        `${videoBitrate}k`,
        "-bufsize",
        `${videoBitrate * 2}k`,
        "-c:a",
        "aac",
        "-b:a",
        `${audioBitrate}k`,
        "-movflags",
        "+faststart",
        "-y",
        outputName,
      ];
    } else {
      // WebM / VP9
      args = [
        "-i",
        inputName,
        "-c:v",
        "libvpx-vp9",
        "-crf",
        crf.toString(),
        "-b:v",
        `${videoBitrate}k`,
        "-c:a",
        "libopus",
        "-b:a",
        `${audioBitrate}k`,
        "-y",
        outputName,
      ];
    }

    // Start compression
    videoState.startTime = Date.now();
    updateVideoProgress(0, "Compressing video...", "Calculating ETA...");

    await ffmpeg.exec(args);

    // Read output
    const data = await ffmpeg.readFile(outputName);
    const mimeType = outputFormat === "mp4" ? "video/mp4" : "video/webm";
    videoState.compressedBlob = new Blob([data.buffer], { type: mimeType });

    // Generate filename
    const baseName = videoState.file.name.replace(/\.[^.]+$/, "");
    videoState.compressedFileName = `${baseName}.${outputFormat}`;

    // Check if it actually got smaller — if not, try a second pass with lower bitrate
    if (videoState.compressedBlob.size > targetSizeBytes * 1.05) {
      // Recalculate with stricter bitrate
      const ratio = targetSizeBytes / videoState.compressedBlob.size;
      videoBitrate = Math.max(50, Math.floor(videoBitrate * ratio * 0.9));

      updateVideoProgress(50, "Optimizing further...", "Adjusting bitrate");

      // Rewrite input (it was consumed)
      await ffmpeg.writeFile(inputName, new Uint8Array(fileData));

      if (outputFormat === "mp4") {
        args = [
          "-i",
          inputName,
          "-c:v",
          "libx264",
          "-preset",
          preset,
          "-b:v",
          `${videoBitrate}k`,
          "-maxrate",
          `${videoBitrate}k`,
          "-bufsize",
          `${videoBitrate * 2}k`,
          "-c:a",
          "aac",
          "-b:a",
          `${Math.min(audioBitrate, 96)}k`,
          "-movflags",
          "+faststart",
          "-y",
          outputName,
        ];
      } else {
        args = [
          "-i",
          inputName,
          "-c:v",
          "libvpx-vp9",
          "-b:v",
          `${videoBitrate}k`,
          "-c:a",
          "libopus",
          "-b:a",
          `${Math.min(audioBitrate, 96)}k`,
          "-y",
          outputName,
        ];
      }

      videoState.startTime = Date.now();
      await ffmpeg.exec(args);

      const data2 = await ffmpeg.readFile(outputName);
      videoState.compressedBlob = new Blob([data2.buffer], { type: mimeType });
    }

    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {
      // ignore cleanup errors
    }

    // Show results
    showVideoResult();

    showToast("Video compressed successfully!", "success");
  } catch (error) {
    console.error("Video compression error:", error);
    showToast(error.message || "Video compression failed", "error");
    document.getElementById("videoProgressSection").style.display = "none";
  } finally {
    videoState.isCompressing = false;
    compressBtn.disabled = false;
    document.getElementById("videoCancelBtn").style.display = "none";
  }
}

function cancelVideoCompression() {
  if (videoState.ffmpeg && videoState.isCompressing) {
    // FFmpeg.wasm doesn't have a clean cancel, so we terminate
    videoState.ffmpeg.terminate();
    videoState.ffmpeg = null;
    videoState.isCompressing = false;

    document.getElementById("videoProgressSection").style.display = "none";
    document.getElementById("videoCompressBtn").disabled = false;
    showToast("Compression cancelled", "warning");
  }
}

// =============================================================================
// Results & Download
// =============================================================================

function showVideoResult() {
  document.getElementById("videoProgressSection").style.display = "none";
  document.getElementById("videoResultSection").style.display = "";

  const originalSize = videoState.file.size;
  const compressedSize = videoState.compressedBlob.size;
  const savedPercent = (
    ((originalSize - compressedSize) / originalSize) *
    100
  ).toFixed(1);

  document.getElementById("videoOriginalSize").textContent =
    formatFileSize(originalSize);
  document.getElementById("videoCompressedSize").textContent =
    formatFileSize(compressedSize);
  document.getElementById("videoSavedPercent").textContent = `${savedPercent}%`;

  document.getElementById("videoResultSection").scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function downloadCompressedVideo() {
  if (!videoState.compressedBlob) return;

  const url = URL.createObjectURL(videoState.compressedBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = videoState.compressedFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =============================================================================
// UI Helpers
// =============================================================================

function showVideoProgress(title, detail) {
  const section = document.getElementById("videoProgressSection");
  section.style.display = "";
  document.getElementById("videoProgressTitle").textContent = title;
  document.getElementById("videoProgressETA").textContent = detail || "";
  document.getElementById("videoProgressFill").style.width = "0%";
  document.getElementById("videoProgressPercent").textContent = "0%";
}

function updateVideoProgress(percent, title, detail) {
  document.getElementById("videoProgressFill").style.width = `${percent}%`;
  document.getElementById("videoProgressPercent").textContent = `${percent}%`;
  if (title) document.getElementById("videoProgressTitle").textContent = title;
  if (detail) document.getElementById("videoProgressETA").textContent = detail;
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getFileExtension(filename) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.substring(dot) : "";
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve(60); // fallback to 60s
    video.src = URL.createObjectURL(file);
  });
}

// =============================================================================
// Event Listeners
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  const videoUploadArea = document.getElementById("videoUploadArea");
  const videoFileInput = document.getElementById("videoFileInput");
  const targetSizeSelect = document.getElementById("videoTargetSize");
  const customSizeGroup = document.getElementById("customSizeGroup");

  // Video drag & drop
  videoUploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    videoUploadArea.classList.add("dragover");
  });

  videoUploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    videoUploadArea.classList.remove("dragover");
  });

  videoUploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    videoUploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) handleVideoFile(files[0]);
  });

  videoUploadArea.addEventListener("click", () => {
    videoFileInput.click();
  });

  videoFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleVideoFile(e.target.files[0]);
    }
    e.target.value = "";
  });

  // Custom target size toggle
  targetSizeSelect.addEventListener("change", () => {
    customSizeGroup.style.display =
      targetSizeSelect.value === "custom" ? "" : "none";
  });
});
