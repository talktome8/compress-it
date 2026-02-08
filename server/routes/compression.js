/**
 * Image Compression Routes
 * Handles file upload, compression, and download endpoints
 */

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");
const archiver = require("archiver");
const { createWriteStream } = require("fs");

const compressionService = require("../services/compressionService");

// Get upload directory - use /tmp on production
const isProduction = process.env.NODE_ENV === "production";
const uploadsDir = isProduction
  ? "/tmp/uploads"
  : path.join(__dirname, "../../uploads");
const compressedDir = isProduction
  ? "/tmp/compressed"
  : path.join(__dirname, "../../compressed");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Only JPG, PNG, GIF, and WebP are allowed.`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 20, // Max 20 files per request
  },
});

/**
 * POST /api/upload
 * Upload multiple images for compression
 */
router.post("/upload", upload.array("images", 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadedFiles = req.files.map((file) => ({
      id: path.basename(file.filename, path.extname(file.filename)),
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype,
    }));

    res.json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/compress
 * Compress uploaded images with specified settings
 */
router.post("/compress", async (req, res) => {
  try {
    const { files, settings } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files to compress" });
    }

    const compressionSettings = {
      quality: parseInt(settings?.quality) || 80,
      outputFormat: settings?.outputFormat || "original",
      resizeWidth: settings?.resizeWidth
        ? parseInt(settings.resizeWidth)
        : null,
      resizeHeight: settings?.resizeHeight
        ? parseInt(settings.resizeHeight)
        : null,
      maintainAspectRatio: settings?.maintainAspectRatio !== false,
    };

    const results = await Promise.all(
      files.map((file) =>
        compressionService.compressImage(file, compressionSettings),
      ),
    );

    res.json({
      success: true,
      results,
      totalOriginalSize: results.reduce((sum, r) => sum + r.originalSize, 0),
      totalCompressedSize: results.reduce(
        (sum, r) => sum + r.compressedSize,
        0,
      ),
    });
  } catch (error) {
    console.error("Compression error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/download/:filename
 * Download a single compressed image
 */
router.get("/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(compressedDir, filename);

    // Check if file exists
    await fs.access(filePath);

    // Get original filename from query or use compressed filename
    const downloadName = req.query.name || filename;

    res.download(filePath, downloadName);
  } catch (error) {
    console.error("Download error:", error);
    res.status(404).json({ error: "File not found" });
  }
});

/**
 * POST /api/download-zip
 * Download multiple compressed images as a ZIP file
 */
router.post("/download-zip", async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files to download" });
    }

    const zipFilename = `compressed-images-${Date.now()}.zip`;
    const zipPath = path.join(compressedDir, zipFilename);

    // Create a write stream for the zip file
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Handle archive events
    output.on("close", async () => {
      // Send the zip file
      res.download(zipPath, zipFilename, async (err) => {
        // Clean up zip file after download
        try {
          await fs.unlink(zipPath);
        } catch (e) {
          console.error("Error cleaning up zip:", e);
        }
      });
    });

    archive.on("error", (err) => {
      throw err;
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add files to the archive
    for (const file of files) {
      const filePath = path.join(compressedDir, file.compressedFilename);
      try {
        await fs.access(filePath);
        archive.file(filePath, {
          name: file.downloadName || file.compressedFilename,
        });
      } catch (e) {
        console.warn(`File not found: ${file.compressedFilename}`);
      }
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("ZIP download error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/preview/:filename
 * Get a preview of the compressed image
 */
router.get("/preview/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(compressedDir, filename);

    // Check if file exists
    await fs.access(filePath);

    // Send the file
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: "Preview not available" });
  }
});

/**
 * DELETE /api/cleanup
 * Clean up temporary files for a session
 */
router.delete("/cleanup", async (req, res) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || fileIds.length === 0) {
      return res.json({ success: true, message: "Nothing to clean up" });
    }

    // Use the module-level directories (already defined at top of file)

    let cleaned = 0;

    for (const id of fileIds) {
      // Try to delete from both directories
      const uploadFiles = await fs.readdir(uploadsDir);
      const compressedFiles = await fs.readdir(compressedDir);

      for (const file of uploadFiles) {
        if (file.startsWith(id)) {
          await fs.unlink(path.join(uploadsDir, file));
          cleaned++;
        }
      }

      for (const file of compressedFiles) {
        if (file.startsWith(id)) {
          await fs.unlink(path.join(compressedDir, file));
          cleaned++;
        }
      }
    }

    res.json({ success: true, message: `Cleaned up ${cleaned} file(s)` });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File size exceeds 50MB limit" });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({ error: "Maximum 20 files allowed per upload" });
    }
  }
  next(error);
});

module.exports = router;
