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
};

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
  outputFormat: document.getElementById("outputFormat"),
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

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
        <span>${message}</span>
    `;
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

/**
 * Validate file type
 */
function isValidImageType(file) {
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  return validTypes.includes(file.type);
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
    if (file.size > 50 * 1024 * 1024) {
      showToast(`${file.name} exceeds 50MB limit`, "error");
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
    state.files.push({
      file,
      thumbnail: createThumbnail(file),
      name: file.name,
      size: file.size,
    });
  });

  updateFilesUI();
  showToast(`${validFiles.length} file(s) added`, "success");
}

/**
 * Remove a file from the list
 */
function removeFile(index) {
  URL.revokeObjectURL(state.files[index].thumbnail);
  state.files.splice(index, 1);
  updateFilesUI();
}

/**
 * Clear all files
 */
function clearAllFiles() {
  state.files.forEach((f) => URL.revokeObjectURL(f.thumbnail));
  state.files = [];
  state.results = [];
  updateFilesUI();
  elements.resultsSection.style.display = "none";
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
                <img src="${file.thumbnail}" alt="${file.name}">
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
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
  const settings = {
    quality: parseInt(elements.qualitySlider.value),
    outputFormat: elements.outputFormat.value,
    resizeWidth: elements.resizeWidth.value || null,
    resizeHeight: elements.resizeHeight.value || null,
  };

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

  const savedPercent = (
    ((data.totalOriginalSize - data.totalCompressedSize) /
      data.totalOriginalSize) *
    100
  ).toFixed(1);
  elements.totalSaved.textContent = `${savedPercent}%`;

  // Render result cards
  elements.resultsGrid.innerHTML = state.results
    .map((result, index) => {
      if (!result.success) {
        return `
                <div class="result-card">
                    <div class="result-info">
                        <div class="result-name">${result.originalName}</div>
                        <div class="result-stats">
                            <span style="color: var(--color-error)">Compression failed: ${result.error}</span>
                        </div>
                    </div>
                </div>
            `;
      }

      return `
            <div class="result-card">
                <div class="result-preview" onclick="openPreview(${index})">
                    <img src="/api/preview/${result.compressedFilename}" alt="${
        result.originalName
      }">
                    <div class="result-preview-overlay">
                        <span>Click to compare</span>
                    </div>
                </div>
                <div class="result-info">
                    <div class="result-name">${result.originalName}</div>
                    <div class="result-stats">
                        <span class="result-original">${formatFileSize(
                          result.originalSize,
                        )}</span>
                        <span class="result-compressed">${formatFileSize(
                          result.compressedSize,
                        )}</span>
                        <span class="result-savings">-${
                          result.savingsPercent
                        }%</span>
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
  link.href = `/api/download/${
    result.compressedFilename
  }?name=${encodeURIComponent(downloadName)}`;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
        Preparing ZIP...
    `;

  try {
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

    showToast("ZIP downloaded successfully!", "success");
  } catch (error) {
    console.error("Download error:", error);
    showToast("Failed to create ZIP", "error");
  } finally {
    elements.downloadAllBtn.disabled = false;
    elements.downloadAllBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download All (ZIP)
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
  elements.previewCompressed.src = `/api/preview/${result.compressedFilename}`;
  elements.previewOriginalSize.textContent = formatFileSize(
    result.originalSize,
  );
  elements.previewCompressedSize.textContent = `${formatFileSize(
    result.compressedSize,
  )} (-${result.savingsPercent}%)`;

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
});

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
