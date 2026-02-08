/**
 * Image Compression Service
 * Uses Sharp library for high-performance image processing
 *
 * Sharp is built on libvips which is:
 * - 4-8x faster than ImageMagick
 * - Uses streaming and parallel processing
 * - Memory efficient with lazy evaluation
 */

const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const { v4: uuidv4 } = require("uuid");

// Get compressed directory - use /tmp on production
const isProduction = process.env.NODE_ENV === "production";
const compressedDir = isProduction
  ? "/tmp/compressed"
  : path.join(__dirname, "../../compressed");

// Compression settings by format
const formatSettings = {
  jpeg: {
    // MozJPEG-style compression for maximum efficiency
    quality: 80,
    mozjpeg: true,
    chromaSubsampling: "4:2:0",
  },
  png: {
    // PNG compression with palette reduction
    compressionLevel: 9,
    palette: true,
    quality: 80,
    effort: 10,
    colors: 256,
  },
  webp: {
    // WebP offers 25-35% better compression than JPEG
    quality: 80,
    effort: 6,
    smartSubsample: true,
  },
  gif: {
    // GIF with optimized palette
    colors: 256,
    effort: 10,
  },
};

/**
 * Get the output format based on input mimetype and user preference
 */
function getOutputFormat(mimetype, outputFormat) {
  const mimeToFormat = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };

  if (outputFormat && outputFormat !== "original") {
    return outputFormat;
  }

  return mimeToFormat[mimetype] || "jpeg";
}

/**
 * Get file extension for format
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
 * Calculate optimal compression settings based on quality slider
 */
function getCompressionOptions(format, quality) {
  const baseSettings = { ...formatSettings[format] };

  switch (format) {
    case "jpeg":
      return {
        quality: quality,
        mozjpeg: true,
        chromaSubsampling: quality > 90 ? "4:4:4" : "4:2:0",
      };

    case "png":
      // For PNG, lower quality = more aggressive compression
      const colors = Math.max(16, Math.floor(256 * (quality / 100)));
      return {
        compressionLevel: 9,
        palette: quality < 100,
        quality: quality,
        effort: 10,
        colors: colors,
      };

    case "webp":
      return {
        quality: quality,
        effort: 6,
        smartSubsample: true,
        nearLossless: quality > 95,
      };

    case "gif":
      const gifColors = Math.max(16, Math.floor(256 * (quality / 100)));
      return {
        colors: gifColors,
        effort: 10,
      };

    default:
      return { quality };
  }
}

/**
 * Compress a single image
 * @param {Object} file - File info object
 * @param {Object} settings - Compression settings
 * @returns {Object} Compression result
 */
async function compressImage(file, settings) {
  const {
    quality,
    outputFormat,
    resizeWidth,
    resizeHeight,
    maintainAspectRatio,
  } = settings;

  const inputPath = file.path;
  const format = getOutputFormat(file.mimetype, outputFormat);
  const extension = getExtension(format);
  const outputFilename = `${file.id}-compressed${extension}`;
  const outputPath = path.join(compressedDir, outputFilename);

  try {
    // Get original file stats
    const originalStats = await fs.stat(inputPath);
    const originalSize = originalStats.size;

    // Initialize Sharp pipeline
    let pipeline = sharp(inputPath);

    // Get image metadata
    const metadata = await pipeline.metadata();

    // Apply resize if specified
    if (resizeWidth || resizeHeight) {
      const resizeOptions = {
        fit: maintainAspectRatio ? "inside" : "fill",
        withoutEnlargement: true,
      };

      if (resizeWidth) resizeOptions.width = resizeWidth;
      if (resizeHeight) resizeOptions.height = resizeHeight;

      pipeline = pipeline.resize(resizeOptions);
    }

    // Apply format-specific compression
    const compressionOptions = getCompressionOptions(format, quality);

    switch (format) {
      case "jpeg":
        pipeline = pipeline.jpeg(compressionOptions);
        break;
      case "png":
        pipeline = pipeline.png(compressionOptions);
        break;
      case "webp":
        pipeline = pipeline.webp(compressionOptions);
        break;
      case "gif":
        pipeline = pipeline.gif(compressionOptions);
        break;
    }

    // Remove metadata to reduce file size (except for color profile)
    pipeline = pipeline.withMetadata({
      orientation: undefined, // Remove orientation, we've already applied it
    });

    // Write output file
    await pipeline.toFile(outputPath);

    // Get compressed file stats
    const compressedStats = await fs.stat(outputPath);
    const compressedSize = compressedStats.size;

    // Calculate savings
    const savedBytes = originalSize - compressedSize;
    const savingsPercent = ((savedBytes / originalSize) * 100).toFixed(1);

    return {
      success: true,
      id: file.id,
      originalName: file.originalName,
      originalSize,
      compressedSize,
      savedBytes,
      savingsPercent: parseFloat(savingsPercent),
      compressedFilename: outputFilename,
      outputFormat: format,
      dimensions: {
        width: metadata.width,
        height: metadata.height,
      },
    };
  } catch (error) {
    console.error(`Error compressing ${file.originalName}:`, error);
    return {
      success: false,
      id: file.id,
      originalName: file.originalName,
      error: error.message,
    };
  }
}

/**
 * Get image metadata without full processing
 */
async function getImageInfo(filePath) {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      hasAlpha: metadata.hasAlpha,
    };
  } catch (error) {
    throw new Error(`Failed to read image: ${error.message}`);
  }
}

module.exports = {
  compressImage,
  getImageInfo,
  getOutputFormat,
  getCompressionOptions,
};
