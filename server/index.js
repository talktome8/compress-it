/**
 * Compress-It: Image Compression Web Application
 * Main Server Entry Point
 *
 * Uses Sharp library for high-performance image processing
 * Sharp is built on libvips - one of the fastest image processing libraries available
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const { existsSync, mkdirSync } = require("fs");

// Import routes
const compressionRoutes = require("./routes/compression");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required directories exist
// Use /tmp on Vercel/production (ephemeral filesystem)
const isServerless =
  process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const uploadsDir = isServerless
  ? "/tmp/uploads"
  : path.join(__dirname, "../uploads");
const compressedDir = isServerless
  ? "/tmp/compressed"
  : path.join(__dirname, "../compressed");

// Export paths for use in other modules
module.exports.uploadsDir = uploadsDir;
module.exports.compressedDir = compressedDir;

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
if (!existsSync(compressedDir)) {
  mkdirSync(compressedDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Serve compressed files
app.use("/compressed", express.static(compressedDir));

// API Routes
app.use("/api", compressionRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Cleanup old files periodically (every hour)
const cleanupInterval = 60 * 60 * 1000; // 1 hour
const maxFileAge = 30 * 60 * 1000; // 30 minutes

async function cleanupOldFiles() {
  try {
    const dirs = [uploadsDir, compressedDir];
    const now = Date.now();

    for (const dir of dirs) {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxFileAge) {
          await fs.unlink(filePath);
          console.log(`Cleaned up: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

// Run cleanup on startup and periodically
cleanupOldFiles();
setInterval(cleanupOldFiles, cleanupInterval);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🖼️  Compress-It Image Compression Server                  ║
║                                                            ║
║   Server running at: http://localhost:${PORT}                 ║
║   Environment: ${
    process.env.NODE_ENV || "development"
  }                           ║
║                                                            ║
║   Supported formats: JPG, PNG, GIF, WebP                   ║
║   Max file size: 50MB                                      ║
║   Max files per batch: 20                                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
