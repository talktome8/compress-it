/**
 * Compress-It - Main Application JavaScript
 * Handles file uploads, compression, previews, and downloads
 */

// =============================================================================
// State Management
// =============================================================================

const state = {
  files: [], // Uploaded files info
  results: [], // Compression results
  isCompressing: false,
  estimateTimer: null,
  estimateController: null,
  estimateCache: new Map(),
  estimateRevision: 0,
};

const MAX_IMAGE_UPLOAD_MB = 4;
const ESTIMATE_DELAY_MS = 700;

// =============================================================================
// DOM Elements
// =============================================================================

const elements = {
  // Upload
  uploadArea: document.getElementById("uploadArea"),
  fileInput: document.getElementById("fileInput"),

  // Settings
  settingsSection: document.getElementById("settingsSection"),
  qualitySlider: document.getElementById("qualitySlider"),
    qualityValue: document.getElementById("qualityValue"),
    sizeEstimate: document.getElementById("sizeEstimate"),
    outputFormat: document.getElementById("outputFormat"),
    targetSizeKB: document.getElementById("targetSizeKB"),
    resizeWidth: document.getElementById("resizeWidth"),
  resizeHeight: document.getElementById("resizeHeight"),
  compressBtn: document.getElementById("compressBtn"),

  // Files
  filesSection: document.getElementById("filesSection"),
  filesList: document.getElementById("filesList"),
  fileCount: document.getElementById("fileCount"),
  clearFilesBtn: document.getElementById("clearFilesBtn"),

  // Progress
  progressSection: document.getElementById("progressSection"),
  progressFill: document.getElementById("progressFill"),
  progressCount: document.getElementById("progressCount"),

  // Results
  resultsSection: document.getElementById("resultsSection"),
  resultsGrid: document.getElementById("resultsGrid"),
  totalOriginal: document.getElementById("totalOriginal"),
  totalCompressed: document.getElementById("totalCompressed"),
  totalSaved: document.getElementById("totalSaved"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
  resetBtn: document.getElementById("resetBtn"),

  // Modal
  previewModal: document.getElementById("previewModal"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalClose: document.getElementById("modalClose"),
  previewOriginal: document.getElementById("previewOriginal"),
  previewCompressed: document.getElementById("previewCompressed"),
  previewOriginalSize: document.getElementById("previewOriginalSize"),
  previewCompressedSize: document.getElementById("previewCompressedSize"),

  // Toast
  toastContainer: document.getElementById("toastContainer"),
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatSavingsBadge(savingsPercent) {
  const value = Number(savingsPercent);
  if (!Number.isFinite(value)) return "0%";
  if (value < 0) return `+${Math.abs(value).toFixed(1)}%`;
  return `-${value.toFixed(1)}%`;
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

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const span = document.createElement("span");
  span.textContent = message;
  toast.appendChild(span);
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideIn 0.3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Create a thumbnail URL from file
 */
function createThumbnail(file) {
  return URL.createObjectURL(file);
}

function readImageDimensions(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Validate file type
 */
function isValidImageType(file) {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(file.type);
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function getCompressedObjectUrl(result) {
  if (!result.compressedData) return null;
  const blob = base64ToBlob(result.compressedData, result.mimeType);
  return URL.createObjectURL(blob);
}

function getPreviewSource(result) {
  if (result.compressedData) {
    return `data:${result.mimeType || "image/jpeg"};base64,${result.compressedData}`;
  }
  return `/api/preview/${result.compressedFilename}`;
}

function getCompressionSettings() {
  return {
    quality: parseInt(elements.qualitySlider.value, 10) || 80,
    outputFormat: elements.outputFormat.value,
    resizeWidth: elements.resizeWidth.value || "",
    resizeHeight: elements.resizeHeight.value || "",
    targetSizeKB: elements.targetSizeKB.value || "",
  };
}

function setEstimateMessage(message, stateName = "idle") {
  elements.sizeEstimate.replaceChildren();
  elements.sizeEstimate.dataset.state = stateName;
  const text = document.createElement("span");
  text.textContent = message;
  elements.sizeEstimate.appendChild(text);
}

function renderMeasuredEstimate(results) {
  const successful = results.filter((result) => result?.success);
  if (successful.length === 0) {
    setEstimateMessage("A measured preview could not be generated. Try compression again.", "error");
    return;
  }

  const originalTotal = successful.reduce(
    (sum, result) => sum + result.originalSize,
    0,
  );
  const compressedTotal = successful.reduce(
    (sum, result) => sum + result.compressedSize,
    0,
  );
  const savings = ((originalTotal - compressedTotal) / originalTotal) * 100;

  elements.sizeEstimate.replaceChildren();
  elements.sizeEstimate.dataset.state = "ready";

  const summary = document.createElement("p");
  summary.append("Measured output: ");
  const size = document.createElement("strong");
  size.textContent = formatFileSize(compressedTotal);
  summary.append(size, ` total (${Math.abs(savings).toFixed(1)}% ${savings >= 0 ? "smaller" : "larger"}).`);
  elements.sizeEstimate.appendChild(summary);

  const note = document.createElement("p");
  note.className = "estimate-note";
  note.textContent = elements.targetSizeKB.value
    ? "The target is a maximum per image. The result can be smaller when re-encoding already reduces the file further."
    : "Measured with the same compression engine and settings used for the final result.";
  elements.sizeEstimate.appendChild(note);

  const list = document.createElement("ul");
  list.className = "estimate-files";
  successful.forEach((result) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = result.originalName;
    const resultSize = document.createElement("strong");
    resultSize.textContent = formatFileSize(result.compressedSize);
    item.append(name, resultSize);
    list.appendChild(item);
  });
  elements.sizeEstimate.appendChild(list);
}

async function measureFiles(revision) {
  if (state.estimateController) state.estimateController.abort();
  state.estimateController = new AbortController();
  const { signal } = state.estimateController;
  const settings = getCompressionSettings();
  const settingsKey = JSON.stringify(settings);
  const results = [];

  try {
    for (let index = 0; index < state.files.length; index++) {
      if (revision !== state.estimateRevision) return;
      const fileInfo = state.files[index];
      const cacheKey = `${fileInfo.name}:${fileInfo.size}:${fileInfo.file.lastModified}:${settingsKey}`;
      let result = state.estimateCache.get(cacheKey);

      if (!result) {
        setEstimateMessage(
          `Running a real test compression (${index + 1} of ${state.files.length})...`,
          "loading",
        );
        const formData = new FormData();
        formData.append("images", fileInfo.file);
        Object.entries(settings).forEach(([key, value]) => {
          if (value !== "") formData.append(key, value);
        });

        const response = await fetch("/api/estimate", {
          method: "POST",
          body: formData,
          signal,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Preview compression failed");
        }

        const payload = await response.json();
        result = payload.results[0];
        state.estimateCache.set(cacheKey, result);
        if (state.estimateCache.size > 100) {
          state.estimateCache.delete(state.estimateCache.keys().next().value);
        }
      }
      results.push(result);
    }

    if (revision === state.estimateRevision) renderMeasuredEstimate(results);
  } catch (error) {
    if (error.name !== "AbortError" && revision === state.estimateRevision) {
      console.error("Measured preview error:", error);
      setEstimateMessage(
        "Measured preview is temporarily unavailable. The final result will still use these settings.",
        "error",
      );
    }
  }
}

function updateSizeEstimate() {
  if (!elements.sizeEstimate) return;
  clearTimeout(state.estimateTimer);
  state.estimateRevision += 1;
  if (state.estimateController) state.estimateController.abort();

  if (state.files.length === 0) {
    setEstimateMessage("Add images to measure the output size.");
    return;
  }
  setEstimateMessage("Waiting to measure with the compression engine...", "loading");
  const revision = state.estimateRevision;
  state.estimateTimer = setTimeout(
    () => measureFiles(revision),
    ESTIMATE_DELAY_MS,
  );
}

// =============================================================================
// File Upload Handling
// =============================================================================

/**
 * Handle file selection
 */
function handleFiles(fileList) {
  const validFiles = Array.from(fileList).filter((file) => {
    if (!isValidImageType(file)) {
      showToast(`${file.name} is not a supported image type`, "error");
      return false;
    }
    if (file.size > MAX_IMAGE_UPLOAD_MB * 1024 * 1024) {
      showToast(
        `${file.name} exceeds the ${MAX_IMAGE_UPLOAD_MB}MB browser image limit`,
        "error",
      );
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  if (state.files.length + validFiles.length > 20) {
    showToast("Maximum 20 files allowed", "warning");
    return;
  }

  // Add files to state
  validFiles.forEach((file) => {
    const thumbnail = createThumbnail(file);
    const fileInfo = {
      file,
      thumbnail,
      name: file.name,
      size: file.size,
      width: null,
      height: null,
    };
    state.files.push(fileInfo);
    readImageDimensions(thumbnail).then((dimensions) => {
      if (!dimensions) return;
      fileInfo.width = dimensions.width;
      fileInfo.height = dimensions.height;
      updateSizeEstimate();
    });
  });

  updateFilesUI();
  updateSizeEstimate();
  showToast(`${validFiles.length} file(s) added`, "success");
}

/**
 * Remove a file from the list
 */
function removeFile(index) {
  URL.revokeObjectURL(state.files[index].thumbnail);
  state.files.splice(index, 1);
  updateFilesUI();
  updateSizeEstimate();
}

/**
 * Clear all files
 */
function clearAllFiles() {
  clearTimeout(state.estimateTimer);
  if (state.estimateController) state.estimateController.abort();
  state.files.forEach((f) => URL.revokeObjectURL(f.thumbnail));
  state.files = [];
  state.results = [];
  state.estimateCache.clear();
  updateFilesUI();
  elements.resultsSection.style.display = "none";
  updateSizeEstimate();
}

/**
 * Update the files list UI
 */
function updateFilesUI() {
  if (state.files.length === 0) {
    elements.filesSection.style.display = "none";
    elements.settingsSection.style.display = "none";
    return;
  }

  elements.filesSection.style.display = "block";
  elements.settingsSection.style.display = "block";
  elements.fileCount.textContent = state.files.length;

  elements.filesList.innerHTML = state.files
    .map(
      (file, index) => `
        <div class="file-item">
            <div class="file-thumb">
                <img src="${file.thumbnail}" alt="${escapeHTML(file.name)}">
            </div>
            <div class="file-info">
                <div class="file-name">${escapeHTML(file.name)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" onclick="removeFile(${index})" title="Remove file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `,
    )
    .join("");
}

// =============================================================================
// Compression
// =============================================================================

/**
 * Upload files to server
 */
async function uploadFiles() {
  const formData = new FormData();
  state.files.forEach((f) => formData.append("images", f.file));

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Upload failed");
  }

  return response.json();
}

/**
 * Compress uploaded files
 */
async function compressFiles(uploadedFiles) {
  const settings = getCompressionSettings();

  const response = await fetch("/api/compress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: uploadedFiles,
      settings,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Compression failed");
  }

  return response.json();
}

/**
 * Handle compress button click
 */
async function handleCompress() {
  if (state.files.length === 0 || state.isCompressing) return;

  state.isCompressing = true;
  elements.compressBtn.disabled = true;
  elements.progressSection.style.display = "block";
  elements.resultsSection.style.display = "none";

  try {
    // Update progress - uploading
    updateProgress(0, state.files.length, "Uploading images...");

    // Upload files
    const uploadResult = await uploadFiles();

    // Update progress - compressing
    updateProgress(50, 100, "Compressing images...");

    // Compress files
    const compressionResult = await compressFiles(uploadResult.files);

    // Update progress - complete
    updateProgress(100, 100, "Complete!");

    // Store results
    state.results = compressionResult.results.map((result, index) => ({
      ...result,
      originalThumbnail: state.files[index].thumbnail,
    }));

    // Show results
    setTimeout(() => {
      elements.progressSection.style.display = "none";
      showResults(compressionResult);
    }, 500);

    showToast("Compression complete!", "success");
  } catch (error) {
    console.error("Compression error:", error);
    showToast(error.message || "Compression failed", "error");
    elements.progressSection.style.display = "none";
  } finally {
    state.isCompressing = false;
    elements.compressBtn.disabled = false;
  }
}

/**
 * Update progress bar
 */
function updateProgress(current, total, label) {
  const percent = Math.round((current / total) * 100);
  elements.progressFill.style.width = `${percent}%`;
  elements.progressCount.textContent = label || `${current}/${total}`;
}

// =============================================================================
// Results Display
// =============================================================================

/**
 * Show compression results
 */
function showResults(data) {
  elements.resultsSection.style.display = "block";

  // Update summary stats
  elements.totalOriginal.textContent = formatFileSize(data.totalOriginalSize);
  elements.totalCompressed.textContent = formatFileSize(
    data.totalCompressedSize,
  );

  const savedPercent =
    ((data.totalOriginalSize - data.totalCompressedSize) /
      data.totalOriginalSize) *
    100;
  elements.totalSaved.textContent =
    savedPercent < 0
      ? `${Math.abs(savedPercent).toFixed(1)}% larger`
      : `${savedPercent.toFixed(1)}%`;

  // Render result cards
  elements.resultsGrid.innerHTML = state.results
    .map((result, index) => {
      if (!result.success) {
        return `
                <div class="result-card">
                    <div class="result-info">
                        <div class="result-name">${escapeHTML(result.originalName)}</div>
                        <div class="result-stats">
                            <span style="color: var(--color-error)">Compression failed: ${escapeHTML(result.error)}</span>
                        </div>
                    </div>
                </div>
            `;
      }

      return `
            <div class="result-card">
                <div class="result-preview" onclick="openPreview(${index})">
                    <img src="${getPreviewSource(result)}" alt="${escapeHTML(
        result.originalName,
      )}">
                    <div class="result-preview-overlay">
                        <span>Click to compare</span>
                    </div>
                </div>
                <div class="result-info">
                    <div class="result-name">${escapeHTML(result.originalName)}</div>
                    <div class="result-stats">
                        <span class="result-original">${formatFileSize(
                          result.originalSize,
                        )}</span>
                        <span class="result-compressed">${formatFileSize(
                          result.compressedSize,
                        )}</span>
                        <span class="result-savings ${
                          result.savingsPercent < 0
                            ? "result-savings-negative"
                            : ""
                        }">${formatSavingsBadge(result.savingsPercent)}</span>
                    </div>
                    <div class="result-actions">
                        <button class="btn btn-success" onclick="downloadSingle(${index})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7,10 12,15 17,10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                        </button>
                        <button class="btn btn-secondary" onclick="openPreview(${index})">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Preview
                        </button>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");

  // Scroll to results
  elements.resultsSection.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

// =============================================================================
// Download Functions
// =============================================================================

/**
 * Download a single compressed image
 */
function downloadSingle(index) {
  const result = state.results[index];
  if (!result || !result.success) return;

  const link = document.createElement("a");
  // Use original filename with new extension (if format changed)
  const originalBaseName = result.originalName.replace(/\.[^.]+$/, "");
  const downloadName = originalBaseName + getExtension(result.outputFormat);
  const objectUrl = getCompressedObjectUrl(result);
  link.href =
    objectUrl ||
    `/api/download/${result.compressedFilename}?name=${encodeURIComponent(
      downloadName,
    )}`;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (objectUrl) {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/**
 * Get file extension from format
 */
function getExtension(format) {
  const extensions = {
    jpeg: ".jpg",
    png: ".png",
    gif: ".gif",
    webp: ".webp",
  };
  return extensions[format] || ".jpg";
}

/**
 * Download all compressed images as ZIP
 */
async function downloadAll() {
  const successfulResults = state.results.filter((r) => r.success);
  if (successfulResults.length === 0) {
    showToast("No files to download", "warning");
    return;
  }

  elements.downloadAllBtn.disabled = true;
  elements.downloadAllBtn.innerHTML = `
        <div class="spinner"></div>
        Preparing downloads...
    `;

  try {
    if (successfulResults.every((result) => result.compressedData)) {
      successfulResults.forEach((result) => {
        downloadSingle(state.results.indexOf(result));
      });
      showToast("Downloads started", "success");
      return;
    }

    const files = successfulResults.map((result) => ({
      compressedFilename: result.compressedFilename,
      // Use original filename with new extension (if format changed)
      downloadName:
        result.originalName.replace(/\.[^.]+$/, "") +
        getExtension(result.outputFormat),
    }));

    const response = await fetch("/api/download-zip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });

    if (!response.ok) {
      throw new Error("Failed to create ZIP");
    }

    // Download the zip file
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `compressed-images-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Download started", "success");
  } catch (error) {
    console.error("Download error:", error);
    showToast("Failed to download files", "error");
  } finally {
    elements.downloadAllBtn.disabled = false;
    elements.downloadAllBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download All
        `;
  }
}

// =============================================================================
// Preview Modal
// =============================================================================

/**
 * Open preview modal
 */
function openPreview(index) {
  const result = state.results[index];
  if (!result || !result.success) return;

  elements.previewOriginal.src = result.originalThumbnail;
  elements.previewCompressed.src = getPreviewSource(result);
  elements.previewOriginalSize.textContent = formatFileSize(
    result.originalSize,
  );
  elements.previewCompressedSize.textContent = `${formatFileSize(
    result.compressedSize,
  )} (${formatSavingsBadge(result.savingsPercent)})`;

  elements.previewModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Close preview modal
 */
function closePreview() {
  elements.previewModal.classList.remove("active");
  document.body.style.overflow = "";
}

// =============================================================================
// Reset
// =============================================================================

/**
 * Reset application state
 */
function reset() {
  // Clean up server files
  const fileIds = state.results.filter((r) => r.success).map((r) => r.id);

  if (fileIds.length > 0) {
    fetch("/api/cleanup", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileIds }),
    }).catch(console.error);
  }

  // Reset state
  clearAllFiles();

  // Reset UI
  elements.resultsSection.style.display = "none";
  elements.progressSection.style.display = "none";

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =============================================================================
// Event Listeners
// =============================================================================

// Drag and drop
elements.uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  elements.uploadArea.classList.add("dragover");
});

elements.uploadArea.addEventListener("dragleave", (e) => {
  e.preventDefault();
  elements.uploadArea.classList.remove("dragover");
});

elements.uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  elements.uploadArea.classList.remove("dragover");
  handleFiles(e.dataTransfer.files);
});

// Click to upload
elements.uploadArea.addEventListener("click", () => {
  elements.fileInput.click();
});

elements.fileInput.addEventListener("change", (e) => {
  handleFiles(e.target.files);
  e.target.value = ""; // Reset input
});

// Quality slider
elements.qualitySlider.addEventListener("input", (e) => {
  elements.qualityValue.textContent = e.target.value;
  updateSizeEstimate();
});

elements.outputFormat.addEventListener("change", updateSizeEstimate);
elements.targetSizeKB.addEventListener("input", updateSizeEstimate);
elements.resizeWidth.addEventListener("input", updateSizeEstimate);
elements.resizeHeight.addEventListener("input", updateSizeEstimate);

// Buttons
elements.compressBtn.addEventListener("click", handleCompress);
elements.clearFilesBtn.addEventListener("click", clearAllFiles);
elements.downloadAllBtn.addEventListener("click", downloadAll);
elements.resetBtn.addEventListener("click", reset);

// Modal
elements.modalClose.addEventListener("click", closePreview);
elements.modalOverlay.addEventListener("click", closePreview);

// Keyboard
document.addEventListener("keydown", (e) => {
  if (
    e.key === "Escape" &&
    elements.previewModal.classList.contains("active")
  ) {
    closePreview();
  }
});

// Prevent default drag behavior on window
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

// =============================================================================
// Initialize
// =============================================================================

console.log("Compress-It initialized");
