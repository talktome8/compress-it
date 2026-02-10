/**
 * Compress-It: Express App Entry Point for Vercel
 *
 * This file serves as the Vercel-compatible entry point.
 * For local development, use server/index.js instead.
 *
 * Vercel auto-detects app.js at the project root and deploys
 * the Express app as a serverless function with Fluid Compute.
 * Static files from public/ are served automatically via CDN.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { existsSync, mkdirSync } = require("fs");

// Import routes
const compressionRoutes = require("./server/routes/compression");

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

// Export the Express app (required by Vercel)
module.exports = app;
