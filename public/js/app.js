/**
 * Compress-It - Main Application JavaScript
 * Handles file uploads, compression, previews, and downloads
 */

const APP_VERSION = '2.1.0';
const isRender = window.location.hostname.includes('onrender.com');
const maxFileSize = isRender ? 50 : 4;
console.log(`Compress-It initialized v${APP_VERSION}`);
console.log(`Platform: ${isRender ? 'Render' : 'Vercel'}`);
console.log(`Max file size: ${maxFileSize}MB`);

// Update UI with correct limits
document.addEventListener('DOMContentLoaded', () => {
    const limitsText = document.getElementById('uploadLimits');
    if (limitsText) {
        limitsText.textContent = `Support for JPG, PNG, GIF, WebP • Max ${maxFileSize}MB per file • Up to 20 files`;
    }
});

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
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),

    // Settings
    settingsSection: document.getElementById('settingsSection'),
    qualitySlider: document.getElementById('qualitySlider'),
    qualityValue: document.getElementById('qualityValue'),
    outputFormat: document.getElementById('outputFormat'),
    resizeWidth: document.getElementById('resizeWidth'),
    resizeHeight: document.getElementById('resizeHeight'),
    compressBtn: document.getElementById('compressBtn'),

    // Files
    filesSection: document.getElementById('filesSection'),
    filesList: document.getElementById('filesList'),
    fileCount: document.getElementById('fileCount'),
    clearFilesBtn: document.getElementById('clearFilesBtn'),

    // Progress
    progressSection: document.getElementById('progressSection'),
    progressFill: document.getElementById('progressFill'),
    progressLabel: document.getElementById('progressLabel'),

    // Results
    resultsSection: document.getElementById('resultsSection'),
    resultsList: document.getElementById('resultsList'),
    totalOriginalSize: document.getElementById('totalOriginalSize'),
    totalCompressedSize: document.getElementById('totalCompressedSize'),
    totalSaved: document.getElementById('totalSaved'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    resetBtn: document.getElementById('resetBtn'),

    // Preview Modal
    previewModal: document.getElementById('previewModal'),
    closePreview: document.getElementById('closePreview'),
    previewOriginal: document.getElementById('previewOriginal'),
    previewCompressed: document.getElementById('previewCompressed'),
    previewOriginalSize: document.getElementById('previewOriginalSize'),
    previewCompressedSize: document.getElementById('previewCompressedSize'),
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/**
 * Create a thumbnail URL from file
 */
function createThumbnail(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

/**
 * Validate file type
 */
function isValidImageType(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
}

// =============================================================================
// File Upload Handling
// =============================================================================

/**
 * Handle file selection
 */
async function handleFiles(fileList) {
    const files = Array.from(fileList);
    
    console.log(`Processing ${files.length} files...`);
    
    // Validate file count
    if (state.files.length + files.length > 20) {
        showToast('Maximum 20 files allowed', 'error');
        return;
    }

    // Process each file
    for (const file of files) {
        console.log(`Checking file: ${file.name} (${formatSize(file.size)})`);
        
        // Validate file type
        if (!isValidImageType(file)) {
            showToast(`${file.name}: Invalid file type. Only JPG, PNG, GIF, and WebP are supported.`, 'error');
            continue;
        }

        // Validate file size - Check if on Render (50MB) or Vercel (4MB)
        const isRender = window.location.hostname.includes('onrender.com');
        const maxSize = isRender ? 50 * 1024 * 1024 : 4 * 1024 * 1024;
        const maxSizeText = isRender ? '50MB' : '4MB';
        
        if (file.size > maxSize) {
            console.warn(`File too large: ${file.name} (${formatSize(file.size)})`);
            const message = isRender 
                ? `${file.name}: File too large (${formatSize(file.size)}). Maximum is 50MB.`
                : `${file.name}: File too large (${formatSize(file.size)}). Maximum is 4MB on Vercel. Deploy to Render for 50MB support.`;
            showToast(message, 'error');
            continue;
        }

        // Create thumbnail
        const thumbnail = await createThumbnail(file);

        // Add to state
        state.files.push({
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            thumbnail,
        });
    }

    if (state.files.length > 0) {
        updateFilesUI();
        elements.filesSection.style.display = 'block';
        elements.settingsSection.style.display = 'block';
    }
}

/**
 * Remove a file from the list
 */
function removeFile(index) {
    state.files.splice(index, 1);
    if (state.files.length === 0) {
        clearAllFiles();
    } else {
        updateFilesUI();
    }
}

/**
 * Clear all files
 */
function clearAllFiles() {
    state.files = [];
    state.results = [];
    elements.filesSection.style.display = 'none';
    elements.settingsSection.style.display = 'none';
    elements.resultsSection.style.display = 'none';
    elements.progressSection.style.display = 'none';
    updateFilesUI();
}

/**
 * Update the files list UI
 */
function updateFilesUI() {
    elements.fileCount.textContent = state.files.length;
    
    elements.filesList.innerHTML = state.files.map((f, index) => `
        <div class="file-item">
            <img src="${f.thumbnail}" alt="${f.name}" class="file-thumbnail">
            <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-size">${formatSize(f.size)}</div>
            </div>
            <button class="btn-remove" onclick="removeFile(${index})" title="Remove">✕</button>
        </div>
    `).join('');
}

// =============================================================================
// Compression
// =============================================================================

/**
 * Upload files to server
 */ole.log(`Uploading ${state.files.length} files to server...`);
    
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
    });

    console.log(`Upload response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
        // Try to parse JSON error, fallback to text if it fails
        let errorMessage = 'Upload failed';
        try {
            const error = await response.json();
            errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
            // Response is not JSON (e.g., HTML error page)
            const text = await response.text();
            console.error('Non-JSON response:', text.substring(0, 200));
            if (response.status === 413) {
                errorMessage = '⚠️ Files too large! Vercel has a 4.5MB total request limit. Try uploading fewer or smaller files (< 4MB each)
        } catch (e) {
            // Response is not JSON (e.g., HTML error page)
            const text = await response.text();
            if (response.status === 413) {
                errorMessage = 'Files too large. Maximum total size is 50MB per file. Please reduce file sizes or upload fewer files.';
            } else {
                errorMessage = `Upload failed (${response.status}): ${text.substring(0, 100)}`;
            }
        }
        throw new Error(errorMessage);
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

    const response = await fetch('/api/compress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: uploadedFiles,
            settings,
        }),
    });

    if (!response.ok) {
        // Try to parse JSON error, fallback to text if it fails
        let errorMessage = 'Compression failed';
        try {
            const error = await response.json();
            errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
            // Response is not JSON
            const text = await response.text();
            errorMessage = `Compression failed (${response.status}): ${text.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
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
    elements.progressSection.style.display = 'block';
    elements.resultsSection.style.display = 'none';

    try {
        // Update progress - uploading
        updateProgress(0, state.files.length, 'Uploading images...');

        // Upload files
        const uploadResult = await uploadFiles();

        // Update progress - compressing
        updateProgress(50, 100, 'Compressing images...');

        // Compress files
        const compressionResult = await compressFiles(uploadResult.files);

        // Update progress - complete
        updateProgress(100, 100, 'Complete!');

        // Store results
        state.results = compressionResult.results.map((result, index) => ({
            ...result,
            originalThumbnail: state.files[index].thumbnail,
        }));

        // Show results
        setTimeout(() => {
            elements.progressSection.style.display = 'none';
            showResults(compressionResult);
        }, 500);

        showToast('Images compressed successfully!', 'success');

    } catch (error) {
        console.error('Compression error:', error);
        elements.progressSection.style.display = 'none';
        showToast(error.message, 'error');
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
    elements.progressFill.style.width = percent + '%';
    elements.progressLabel.textContent = label;
}

// =============================================================================
// Results Display
// =============================================================================

/**
 * Show compression results
 */
function showResults(data) {
    elements.resultsSection.style.display = 'block';

    // Calculate totals
    const totalOriginal = data.totalOriginalSize;
    const totalCompressed = data.totalCompressedSize;
    const savedPercent = ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1);

    elements.totalOriginalSize.textContent = formatSize(totalOriginal);
    elements.totalCompressedSize.textContent = formatSize(totalCompressed);
    elements.totalSaved.textContent = savedPercent + '%';

    // Display individual results
    elements.resultsList.innerHTML = state.results.map((result, index) => {
        const saved = ((result.originalSize - result.compressedSize) / result.originalSize * 100).toFixed(1);
        
        return `
            <div class="result-item">
                <img src="${result.originalThumbnail}" alt="${result.originalName}" class="result-thumbnail">
                <div class="result-info">
                    <div class="result-name">${result.originalName}</div>
                    <div class="result-sizes">
                        ${formatSize(result.originalSize)} → ${formatSize(result.compressedSize)}
                        <span class="badge-success">-${saved}%</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="btn-icon" onclick="openPreview(${index})" title="Preview">👁️</button>
                    <button class="btn-primary btn-small" onclick="downloadSingle(${index})">Download</button>
                </div>
            </div>
        `;
    }).join('');

    // Scroll to results
    elements.resultsSection.scrollIntoView({ behavior: 'smooth' });
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

    const link = document.createElement('a');
    // Use original filename with new extension (if format changed)
    const originalBaseName = result.originalName.replace(/\.[^.]+$/, '');
    const downloadName = originalBaseName + getExtension(result.outputFormat);
    link.href = `/api/download/${result.compressedFilename}?name=${encodeURIComponent(downloadName)}`;
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
        jpeg: '.jpg',
        png: '.png',
        gif: '.gif',
        webp: '.webp',
    };
    return extensions[format] || '.jpg';
}

/**
 * Download all compressed images as ZIP
 */
async function downloadAll() {
    const successfulResults = state.results.filter(r => r.success);
    if (successfulResults.length === 0) {
        showToast('No files to download', 'warning');
        return;
    }

    elements.downloadAllBtn.disabled = true;
    elements.downloadAllBtn.innerHTML = `
        <div class="spinner"></div>
        Preparing ZIP...
    `;

    try {
        const files = successfulResults.map(result => ({
            compressedFilename: result.compressedFilename,
            // Use original filename with new extension (if format changed)
            downloadName: result.originalName.replace(/\.[^.]+$/, '') + getExtension(result.outputFormat),
        }));

        const response = await fetch('/api/download-zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files }),
        });

        if (!response.ok) {
            throw new Error('Failed to create ZIP');
        }

        // Download the zip file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `compressed-images-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        showToast('ZIP download started', 'success');

    } catch (error) {
        console.error('Download error:', error);
        showToast('Failed to download ZIP', 'error');
    } finally {
        elements.downloadAllBtn.disabled = false;
        elements.downloadAllBtn.innerHTML = '📦 Download All (ZIP)';
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
    if (!result) return;

    elements.previewOriginal.src = result.originalThumbnail;
    elements.previewCompressed.src = `/compressed/${result.compressedFilename}`;
    elements.previewOriginalSize.textContent = `Original: ${formatSize(result.originalSize)}`;
    elements.previewCompressedSize.textContent = `Compressed: ${formatSize(result.compressedSize)}`;
    elements.previewModal.style.display = 'flex';
}

/**
 * Close preview modal
 */
function closePreview() {
    elements.previewModal.style.display = 'none';
}

// =============================================================================
// Reset
// =============================================================================

/**
 * Reset application state
 */
function reset() {
    clearAllFiles();
    showToast('Ready for new batch', 'info');
}

// =============================================================================
// Event Listeners
// =============================================================================

// Drag and drop
elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
});

elements.uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
});

elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

// Click to upload
elements.uploadArea.addEventListener('click', () => {
    elements.fileInput.click();
});

elements.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Clear input to allow re-selecting same files
});

// Quality slider
elements.qualitySlider.addEventListener('input', (e) => {
    elements.qualityValue.textContent = e.target.value;
});

// Compress button
elements.compressBtn.addEventListener('click', handleCompress);

// Clear files button
elements.clearFilesBtn.addEventListener('click', clearAllFiles);

// Download all button
elements.downloadAllBtn.addEventListener('click', downloadAll);

// Reset button
elements.resetBtn.addEventListener('click', reset);

// Preview modal close
elements.closePreview.addEventListener('click', closePreview);
elements.previewModal.addEventListener('click', (e) => {
    if (e.target === elements.previewModal) {
        closePreview();
    }
});

// Make functions globally accessible for inline onclick handlers
window.removeFile = removeFile;
window.downloadSingle = downloadSingle;
window.openPreview = openPreview;
