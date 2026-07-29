/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel's serverless environment
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { existsSync, mkdirSync } = require("fs");

// Initialize Express app
const app = express();

// Ensure /tmp directories exist (Vercel only allows writing to /tmp)
const uploadsDir = "/tmp/uploads";
const compressedDir = "/tmp/compressed";
const maxImageUploadMB = process.env.VERCEL === "1" ? 4 : 50;

if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
if (!existsSync(compressedDir)) {
  mkdirSync(compressedDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Serve compressed files (for Vercel)
app.use("/compressed", express.static(compressedDir));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Load native image dependencies only when a compression route is requested.
let compressionRoutes;
app.use("/api", (req, res, next) => {
  try {
    compressionRoutes ||= require("../server/routes/compression");
    return compressionRoutes(req, res, next);
  } catch (error) {
    console.error("API initialization error:", error);
    return res.status(500).json({ error: "Compression service unavailable" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: "File too large",
        message: `Maximum file size is ${maxImageUploadMB}MB per file`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        error: "Too many files",
        message: "Maximum 20 files allowed per upload",
      });
    }
    return res.status(400).json({
      error: "Upload error",
      message: err.message,
    });
  }
  
  // Handle other errors
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

module.exports = app;
