/**
 * Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel's serverless environment
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const { existsSync, mkdirSync } = require("fs");

// Import routes
const compressionRoutes = require("../server/routes/compression");

// Initialize Express app
const app = express();

// Ensure /tmp directories exist (Vercel only allows writing to /tmp)
const uploadsDir = "/tmp/uploads";
const compressedDir = "/tmp/compressed";

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

module.exports = app;
