/**
 * Compress-It Desktop — Renderer
 * Handles all UI logic for image and video compression
 */

// =============================================================================
// State
// =============================================================================

const state = {
  imageFiles: [], // { path, name, size }
  imageResults: [], // { originalName, outputName, originalSize, compressedSize, data }
  videoFile: null, // { path, name, size }
  videoOutputPath: null,
  isCompressing: false,
};

// =============================================================================
// Tab Switching
// =============================================================================

function switchMode(mode) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".mode-content")
    .forEach((m) => m.classList.remove("active"));
  document.querySelector(`.tab[data-mode="${mode}"]`).classList.add("active");
  document
    .getElementById(mode === "images" ? "imageMode" : "videoMode")
    .classList.add("active");
}

// =============================================================================
// Utilities
// =============================================================================

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function formatSavingsBadge(savingsPercent) {
  const value = Number(savingsPercent);
  if (!Number.isFinite(value)) return "0%";
  if (value < 0) return `+${Math.abs(value).toFixed(1)}%`;
  return `-${value.toFixed(1)}%`;
}

function getEstimatedImageSize(fileInfo) {
  const quality = Math.max(
    1,
    Math.min(100, parseInt(document.getElementById("qualitySlider").value, 10) || 80),
  );
  const format = document.getElementById("outputFormat").value;
  const q = quality / 100;
  const factors = {
    jpeg: 0.16 + q * 0.72,
    webp: 0.12 + q * 0.62,
    png: 0.36 + q * 0.68,
    original: 0.22 + q * 0.74,
  };
  return Math.max(512, Math.round(fileInfo.size * (factors[format] || factors.original)));
}

function updateImageSizeEstimate() {
  const estimate = document.getElementById("imageSizeEstimate");
  if (!estimate) return;
  if (state.imageFiles.length === 0) {
    estimate.textContent = "Add images to estimate output size.";
    return;
  }

  const originalTotal = state.imageFiles.reduce((sum, f) => sum + f.size, 0);
  const estimatedTotal = state.imageFiles.reduce(
    (sum, f) => sum + getEstimatedImageSize(f),
    0,
  );
  const delta = ((originalTotal - estimatedTotal) / originalTotal) * 100;
  const trend =
    delta >= 0 ? `${delta.toFixed(0)}% smaller` : `${Math.abs(delta).toFixed(0)}% larger`;
  estimate.innerHTML = `Estimated output: <strong>${formatSize(
    estimatedTotal,
  )}</strong> (${trend}). Exact size appears after compression.`;
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// =============================================================================
// Image Compression
// =============================================================================

function addImageFiles(files) {
  for (const f of files) {
    if (!state.imageFiles.find((x) => x.path === f.path)) {
      state.imageFiles.push(f);
    }
  }
  renderImageFileList();
  document.getElementById("imageSettings").style.display = "";
  document.getElementById("imageResults").style.display = "none";
  updateImageSizeEstimate();
}

function removeImageFile(index) {
  state.imageFiles.splice(index, 1);
  if (state.imageFiles.length === 0) {
    document.getElementById("imageSettings").style.display = "none";
  }
  renderImageFileList();
  updateImageSizeEstimate();
}

function clearImages() {
  state.imageFiles = [];
  state.imageResults = [];
  document.getElementById("imageSettings").style.display = "none";
  document.getElementById("imageResults").style.display = "none";
  document.getElementById("imageProgress").style.display = "none";
  updateImageSizeEstimate();
}

function renderImageFileList() {
  const list = document.getElementById("imageFileList");
  list.innerHTML = state.imageFiles
    .map(
      (f, i) => `
    <div class="file-item">
      <span class="name">${escapeHTML(f.name)}</span>
      <span class="size">${formatSize(f.size)}</span>
      <button class="remove" onclick="removeImageFile(${i})" title="Remove">✕</button>
    </div>`,
    )
    .join("");
}

async function compressAllImages() {
  if (state.imageFiles.length === 0 || state.isCompressing) return;
  state.isCompressing = true;
  state.imageResults = [];

  const progress = document.getElementById("imageProgress");
  const fill = document.getElementById("imgProgressFill");
  const label = document.getElementById("imgProgressLabel");
  const count = document.getElementById("imgProgressCount");
  progress.style.display = "";
  document.getElementById("imageResults").style.display = "none";

  const quality = parseInt(document.getElementById("qualitySlider").value);
  const outputFormat = document.getElementById("outputFormat").value;
  const total = state.imageFiles.length;

  for (let i = 0; i < total; i++) {
    const f = state.imageFiles[i];
    label.textContent = `Compressing ${f.name}...`;
    count.textContent = `${i + 1}/${total}`;
    fill.style.width = `${((i + 1) / total) * 100}%`;

    const result = await window.compressIt.compressImage(f.path, {
      quality,
      outputFormat,
    });

    if (result.success) {
      state.imageResults.push(result);
    } else {
      showToast(`Failed: ${f.name} — ${result.error}`, "error");
    }
  }

  progress.style.display = "none";
  state.isCompressing = false;

  if (state.imageResults.length > 0) {
    showImageResults();
    showToast(`${state.imageResults.length} images compressed!`, "success");
  }
}

function showImageResults() {
  const resultsDiv = document.getElementById("imageResults");
  const grid = document.getElementById("imageResultsGrid");
  resultsDiv.style.display = "";

  let totalOrig = 0;
  let totalComp = 0;

  grid.innerHTML = state.imageResults
    .map((r, i) => {
      totalOrig += r.originalSize;
      totalComp += r.compressedSize;
      const saved = (
        ((r.originalSize - r.compressedSize) / r.originalSize) *
        100
      );
      return `
      <div class="result-item">
        <div class="info">
          <div class="name">${escapeHTML(r.outputName)}</div>
          <div class="sizes">
            <span>${formatSize(
              r.originalSize,
            )}</span> → <span class="compressed">${formatSize(
        r.compressedSize,
      )}</span>
          </div>
        </div>
        <span class="badge">${formatSavingsBadge(saved)}</span>
        <button class="save-btn" onclick="saveImage(${i})">Save</button>
      </div>`;
    })
    .join("");

  const totalSaved = ((totalOrig - totalComp) / totalOrig) * 100;
  document.getElementById("imgOrigSize").textContent = formatSize(totalOrig);
  document.getElementById("imgCompSize").textContent = formatSize(totalComp);
  document.getElementById("imgSaved").textContent = formatSavingsBadge(totalSaved);
}

async function saveImage(index) {
  const r = state.imageResults[index];
  const result = await window.compressIt.saveFile(
    r.compressedData,
    r.outputName,
  );
  if (result.success) {
    showToast(`Saved ${r.outputName}`, "success");
  }
}

async function saveAllImages() {
  for (let i = 0; i < state.imageResults.length; i++) {
    await saveImage(i);
  }
}

// =============================================================================
// Video Compression
// =============================================================================

async function addVideoFile(files) {
  if (files.length === 0) return;
  const f = files[0];
  state.videoFile = f;

  document.getElementById("videoSettings").style.display = "";
  document.getElementById("videoResult").style.display = "none";
  document.getElementById("videoProgress").style.display = "none";

  document.getElementById("vFileName").textContent = f.name;
  document.getElementById("vFileSize").textContent = formatSize(f.size);

  // Get detailed info
  const info = await window.compressIt.getVideoInfo(f.path);
  if (info.success) {
    document.getElementById("vFileDuration").textContent = formatTime(
      info.duration,
    );
    document.getElementById(
      "vFileRes",
    ).textContent = `${info.width}×${info.height}`;
  }
}

function clearVideo() {
  state.videoFile = null;
  state.videoOutputPath = null;
  document.getElementById("videoSettings").style.display = "none";
  document.getElementById("videoResult").style.display = "none";
  document.getElementById("videoProgress").style.display = "none";
}

async function compressVideo() {
  if (!state.videoFile || state.isCompressing) return;

  // Get target size
  const sizeSelect = document.getElementById("videoTargetSize");
  let targetSizeMB;
  if (sizeSelect.value === "custom") {
    targetSizeMB = parseInt(document.getElementById("videoCustomSize").value);
    if (!targetSizeMB || targetSizeMB < 1) {
      showToast("Enter a valid target size", "error");
      return;
    }
  } else {
    targetSizeMB = parseInt(sizeSelect.value);
  }

  // Check if already small enough
  const fileSizeMB = state.videoFile.size / (1024 * 1024);
  if (fileSizeMB <= targetSizeMB) {
    showToast(`Already under ${targetSizeMB}MB!`, "success");
    return;
  }

  // Ask where to save
  const ext = document.getElementById("videoFormat").value;
  const baseName = state.videoFile.name.replace(/\.[^.]+$/, "");
  const savePath = await window.compressIt.selectSavePath(`${baseName}.${ext}`);
  if (!savePath) return;

  state.isCompressing = true;
  state.videoOutputPath = savePath;
  const btn = document.getElementById("videoCompressBtn");
  btn.disabled = true;

  // Show progress
  document.getElementById("videoProgress").style.display = "";
  document.getElementById("videoResult").style.display = "none";
  document.getElementById("vidProgressFill").style.width = "0%";
  document.getElementById("vidProgressPercent").textContent = "0%";
  document.getElementById("vidProgressSpeed").textContent = "Starting...";

  const result = await window.compressIt.compressVideo(
    state.videoFile.path,
    savePath,
    {
      targetSizeMB,
      quality: document.getElementById("videoQuality").value,
      outputFormat: ext,
    },
  );

  state.isCompressing = false;
  btn.disabled = false;
  document.getElementById("videoProgress").style.display = "none";

  if (result.success) {
    // Show result
    document.getElementById("videoResult").style.display = "";
    document.getElementById("vidOrigSize").textContent = formatSize(
      result.originalSize,
    );
    document.getElementById("vidCompSize").textContent = formatSize(
      result.compressedSize,
    );
    const saved = (
      ((result.originalSize - result.compressedSize) / result.originalSize) *
      100
    );
    document.getElementById("vidSaved").textContent = formatSavingsBadge(saved);
    showToast("Video compressed successfully!", "success");
  } else if (result.cancelled) {
    showToast("Compression cancelled", "warning");
  } else {
    showToast(result.error || "Compression failed", "error");
  }
}

async function cancelVideo() {
  if (state.videoFile) {
    await window.compressIt.cancelVideo(state.videoFile.path);
  }
}

function openVideoFile() {
  if (state.videoOutputPath) {
    window.compressIt.openPath(state.videoOutputPath);
  }
}

// =============================================================================
// Drag & Drop + Click to Browse
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Video progress listener — register once to avoid accumulating listeners
  window.compressIt.onVideoProgress((data) => {
    document.getElementById("vidProgressFill").style.width = `${data.percent}%`;
    document.getElementById(
      "vidProgressPercent",
    ).textContent = `${data.percent}%`;
    document.getElementById(
      "vidProgressLabel",
    ).textContent = `Compressing... ${data.percent}%`;
    document.getElementById("vidProgressSpeed").textContent = data.speed || "—";
  });

  // Quality slider
  const slider = document.getElementById("qualitySlider");
  const valDisplay = document.getElementById("qualityVal");
  slider.addEventListener(
    "input",
    () => {
      valDisplay.textContent = slider.value;
      updateImageSizeEstimate();
    },
  );
  document
    .getElementById("outputFormat")
    .addEventListener("change", updateImageSizeEstimate);

  // Custom video size toggle
  const targetSelect = document.getElementById("videoTargetSize");
  targetSelect.addEventListener("change", () => {
    document.getElementById("customSizeGroup").style.display =
      targetSelect.value === "custom" ? "" : "none";
  });

  // Image dropzone
  setupDropzone("imageDropzone", "image", (files) => addImageFiles(files));

  // Video dropzone
  setupDropzone("videoDropzone", "video", (files) => addVideoFile(files));
});

function setupDropzone(id, type, onFiles) {
  const el = document.getElementById(id);

  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    el.classList.add("dragover");
  });
  el.addEventListener("dragleave", () => el.classList.remove("dragover"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("dragover");
    const files = Array.from(e.dataTransfer.files).map((f) => ({
      path: f.path,
      name: f.name,
      size: f.size,
    }));
    onFiles(files);
  });
  el.addEventListener("click", async () => {
    const files = await window.compressIt.selectFiles(type);
    if (files.length > 0) onFiles(files);
  });
}
