// ═══════════════════════════════════════════════════════════
// QR-DECODER.JS — Client-side Multi-Pass QR Decoder (Snap-Decode)
// Architecture: 6-Pass Progressive Pipeline via Pure Canvas/Pixel
// Manipulation + Local jsQR Engine. Zero Backend Dependency.
// ═══════════════════════════════════════════════════════════

(function (root, factory) {
  var moduleExports = factory();
  if (typeof exports === "object" && typeof module === "object") {
    module.exports = moduleExports;
    module.exports.default = moduleExports;
  } else if (typeof define === "function" && define.amd) {
    define([], function () { return moduleExports; });
  } else if (typeof exports === "object") {
    exports["SnapQRDecoder"] = moduleExports;
  }

  if (typeof root !== "undefined" && root) root["SnapQRDecoder"] = moduleExports;
  if (typeof window !== "undefined" && window) window["SnapQRDecoder"] = moduleExports;
  if (typeof self !== "undefined" && self) self["SnapQRDecoder"] = moduleExports;
  if (typeof globalThis !== "undefined" && globalThis) globalThis["SnapQRDecoder"] = moduleExports;
})(typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : this), function () {

  /**
   * Resolves the jsQR instance across Browser, Extension Scripting, and Node environments.
   */
  function getJsQR() {
    if (typeof jsQR !== "undefined" && typeof jsQR === "function") return jsQR;
    if (typeof window !== "undefined" && window.jsQR) return window.jsQR;
    if (typeof self !== "undefined" && self.jsQR) return self.jsQR;
    if (typeof globalThis !== "undefined" && globalThis.jsQR) return globalThis.jsQR;
    try {
      if (typeof require === "function") {
        return require("../lib/jsqr.js");
      }
    } catch (e) {}
    return null;
  }

  /**
   * Composite transparent pixels onto a pure white (#ffffff) background.
   * Prevents decoding failure on transparent PNGs.
   */
  function ensureWhiteBackground(imageData) {
    const { data, width, height } = imageData;
    const len = data.length;
    let hasAlpha = false;

    for (let i = 3; i < len; i += 4) {
      if (data[i] < 255) {
        hasAlpha = true;
        break;
      }
    }

    if (!hasAlpha) return imageData;

    const copy = new Uint8ClampedArray(len);
    for (let i = 0; i < len; i += 4) {
      const a = data[i + 3] / 255;
      const invA = 1 - a;
      copy[i]     = Math.round(data[i] * a + 255 * invA);     // R
      copy[i + 1] = Math.round(data[i + 1] * a + 255 * invA); // G
      copy[i + 2] = Math.round(data[i + 2] * a + 255 * invA); // B
      copy[i + 3] = 255;                                      // A
    }

    return { data: copy, width, height };
  }

  /**
   * Pass 2: Grayscale & Histogram Contrast Stretching (Min-Max Normalization).
   * Stretches dynamic range to [0, 255] ignoring extreme 1% outliers.
   */
  function processGrayscaleAndContrast(imageData) {
    const { data, width, height } = imageData;
    const numPixels = width * height;
    const grays = new Uint8Array(numPixels);
    const hist = new Int32Array(256);

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const y = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      grays[p] = y;
      hist[y]++;
    }

    // Find 1st and 99th percentile for robust min-max normalization
    const lowThreshold = Math.floor(numPixels * 0.01);
    const highThreshold = Math.floor(numPixels * 0.99);

    let accumulated = 0;
    let minVal = 0;
    let maxVal = 255;

    for (let i = 0; i < 256; i++) {
      accumulated += hist[i];
      if (accumulated >= lowThreshold) {
        minVal = i;
        break;
      }
    }

    accumulated = 0;
    for (let i = 255; i >= 0; i--) {
      accumulated += hist[i];
      if (accumulated >= (numPixels - highThreshold)) {
        maxVal = i;
        break;
      }
    }

    if (maxVal <= minVal) {
      minVal = 0;
      maxVal = 255;
    }

    const lut = new Uint8ClampedArray(256);
    const range = maxVal - minVal;
    for (let i = 0; i < 256; i++) {
      if (i <= minVal) {
        lut[i] = 0;
      } else if (i >= maxVal) {
        lut[i] = 255;
      } else {
        lut[i] = Math.round(((i - minVal) * 255) / range);
      }
    }

    const out = new Uint8ClampedArray(data.length);
    for (let p = 0, idx = 0; p < numPixels; p++, idx += 4) {
      const v = lut[grays[p]];
      out[idx]     = v;
      out[idx + 1] = v;
      out[idx + 2] = v;
      out[idx + 3] = 255;
    }

    return {
      imageData: { data: out, width, height },
      grays
    };
  }

  /**
   * Computes Otsu's optimal threshold from a grayscale histogram.
   */
  function computeOtsuThreshold(grays, totalPixels) {
    const hist = new Int32Array(256);
    for (let i = 0; i < totalPixels; i++) {
      hist[grays[i]]++;
    }

    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * hist[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVar = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const betweenVar = wB * wF * (mB - mF) * (mB - mF);

      if (betweenVar > maxVar) {
        maxVar = betweenVar;
        threshold = t;
      }
    }

    return threshold;
  }

  /**
   * Pass 3A: Otsu Global Binarization.
   */
  function processOtsuBinarization(grays, width, height) {
    const total = width * height;
    const thresh = computeOtsuThreshold(grays, total);
    const out = new Uint8ClampedArray(total * 4);

    for (let i = 0, p = 0; i < total; i++, p += 4) {
      const val = grays[i] >= thresh ? 255 : 0;
      out[p]     = val;
      out[p + 1] = val;
      out[p + 2] = val;
      out[p + 3] = 255;
    }

    return { data: out, width, height };
  }

  /**
   * Pass 3B: Local Adaptive Binarization (Bradley-Roth via Integral Image).
   * Handles uneven illumination and shadow gradients.
   */
  function processLocalAdaptiveBinarization(grays, width, height) {
    const total = width * height;
    const integral = new Float64Array((width + 1) * (height + 1));

    // Compute integral image
    for (let y = 0; y < height; y++) {
      let rowSum = 0;
      const yIdx = (y + 1) * (width + 1);
      const prevYIdx = y * (width + 1);
      for (let x = 0; x < width; x++) {
        rowSum += grays[y * width + x];
        integral[yIdx + x + 1] = integral[prevYIdx + x + 1] + rowSum;
      }
    }

    const s = Math.max(8, Math.floor(Math.min(width, height) / 8));
    const r = Math.floor(s / 2);
    const t = 0.12; // 12% lower than local mean
    const out = new Uint8ClampedArray(total * 4);

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - r);
      const y2 = Math.min(height - 1, y + r);
      const rowIdx = y * width;

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(width - 1, x + r);

        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum =
          integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
          integral[y1 * (width + 1) + (x2 + 1)] -
          integral[(y2 + 1) * (width + 1) + x1] +
          integral[y1 * (width + 1) + x1];

        const val = grays[rowIdx + x] * count < sum * (1 - t) ? 0 : 255;
        const p = (rowIdx + x) * 4;
        out[p]     = val;
        out[p + 1] = val;
        out[p + 2] = val;
        out[p + 3] = 255;
      }
    }

    return { data: out, width, height };
  }

  /**
   * Pass 4: Inverted colors for Dark Mode (white modules on dark background).
   */
  function processColorInversion(imageData) {
    const { data, width, height } = imageData;
    const out = new Uint8ClampedArray(data.length);

    for (let i = 0; i < data.length; i += 4) {
      out[i]     = 255 - data[i];
      out[i + 1] = 255 - data[i + 1];
      out[i + 2] = 255 - data[i + 2];
      out[i + 3] = 255;
    }

    return { data: out, width, height };
  }

  /**
   * Pass 5: 2x Bilinear Interpolation Upscaling for small QR crops.
   */
  function processUpscale2x(imageData) {
    const { data, width, height } = imageData;
    const newW = width * 2;
    const newH = height * 2;
    const out = new Uint8ClampedArray(newW * newH * 4);

    for (let y = 0; y < newH; y++) {
      const srcY = y / 2;
      const y0 = Math.floor(srcY);
      const y1 = Math.min(height - 1, y0 + 1);
      const dy = srcY - y0;
      const invDy = 1 - dy;

      for (let x = 0; x < newW; x++) {
        const srcX = x / 2;
        const x0 = Math.floor(srcX);
        const x1 = Math.min(width - 1, x0 + 1);
        const dx = srcX - x0;
        const invDx = 1 - dx;

        const w00 = invDx * invDy;
        const w10 = dx * invDy;
        const w01 = invDx * dy;
        const w11 = dx * dy;

        const p00 = (y0 * width + x0) * 4;
        const p10 = (y0 * width + x1) * 4;
        const p01 = (y1 * width + x0) * 4;
        const p11 = (y1 * width + x1) * 4;

        const outIdx = (y * newW + x) * 4;
        for (let c = 0; c < 3; c++) {
          out[outIdx + c] = Math.round(
            data[p00 + c] * w00 +
            data[p10 + c] * w10 +
            data[p01 + c] * w01 +
            data[p11 + c] * w11
          );
        }
        out[outIdx + 3] = 255;
      }
    }

    return { data: out, width: newW, height: newH };
  }

  /**
   * Pass 6: Rotate image by 90, 180, or 270 degrees clockwise.
   */
  function rotateImageData(imageData, degrees) {
    const { data, width, height } = imageData;
    let newW = width;
    let newH = height;

    if (degrees === 90 || degrees === 270) {
      newW = height;
      newH = width;
    }

    const out = new Uint8ClampedArray(newW * newH * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let targetX = x;
        let targetY = y;

        if (degrees === 90) {
          targetX = height - 1 - y;
          targetY = x;
        } else if (degrees === 180) {
          targetX = width - 1 - x;
          targetY = height - 1 - y;
        } else if (degrees === 270) {
          targetX = y;
          targetY = width - 1 - x;
        }

        const srcIdx = (y * width + x) * 4;
        const tgtIdx = (targetY * newW + targetX) * 4;

        out[tgtIdx]     = data[srcIdx];
        out[tgtIdx + 1] = data[srcIdx + 1];
        out[tgtIdx + 2] = data[srcIdx + 2];
        out[tgtIdx + 3] = data[srcIdx + 3];
      }
    }

    return { data: out, width: newW, height: newH };
  }

  /**
   * Core Multi-Pass Decoding Routine on ImageData.
   * Iterates through 6 sequential passes, returning immediately upon detection.
   *
   * @param {Object} inputImageData - { data: Uint8ClampedArray, width: number, height: number }
   * @returns {Object} { success: boolean, mode: 'qr', text?: string, elapsedMs: number, pass?: number, error?: string }
   */
  function decodeFromImageData(inputImageData) {
    const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const engine = getJsQR();

    if (!engine) {
      return {
        success: false,
        mode: "qr",
        error: "Thư viện jsQR chưa sẵn sàng hoặc không tìm thấy.",
        elapsedMs: 0
      };
    }

    if (!inputImageData || !inputImageData.data || !inputImageData.width || !inputImageData.height) {
      return {
        success: false,
        mode: "qr",
        error: "Dữ liệu hình ảnh không hợp lệ.",
        elapsedMs: 0
      };
    }

    // Preprocessing: Composite transparent PNG onto pure white background
    const baseImg = ensureWhiteBackground(inputImageData);

    // ──────────────────────────────────────────────────────────
    // PASS 1: Raw decode via jsQR (Fastest path for clean QR)
    // ──────────────────────────────────────────────────────────
    let res = engine(baseImg.data, baseImg.width, baseImg.height, { inversionAttempts: "dontInvert" });
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 1
      };
    }

    // ──────────────────────────────────────────────────────────
    // PASS 2: Grayscale & Histogram Contrast Stretching
    // ──────────────────────────────────────────────────────────
    const { imageData: contrastImg, grays } = processGrayscaleAndContrast(baseImg);
    res = engine(contrastImg.data, contrastImg.width, contrastImg.height, { inversionAttempts: "dontInvert" });
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 2
      };
    }

    // ──────────────────────────────────────────────────────────
    // PASS 3: Adaptive Binarization (Otsu & Local Bradley-Roth)
    // ──────────────────────────────────────────────────────────
    // 3A. Otsu Global Binarization
    const otsuImg = processOtsuBinarization(grays, baseImg.width, baseImg.height);
    res = engine(otsuImg.data, otsuImg.width, otsuImg.height, { inversionAttempts: "dontInvert" });
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 3
      };
    }

    // 3B. Local Adaptive Binarization
    const adaptiveImg = processLocalAdaptiveBinarization(grays, baseImg.width, baseImg.height);
    res = engine(adaptiveImg.data, adaptiveImg.width, adaptiveImg.height, { inversionAttempts: "dontInvert" });
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 3
      };
    }

    // ──────────────────────────────────────────────────────────
    // PASS 4: Color Inversion (Dark Mode QRs)
    // ──────────────────────────────────────────────────────────
    const invertedImg = processColorInversion(baseImg);
    res = engine(invertedImg.data, invertedImg.width, invertedImg.height, { inversionAttempts: "dontInvert" });
    if (!res || !res.data) {
      // Try contrast stretch on inverted image
      const { imageData: invContrast } = processGrayscaleAndContrast(invertedImg);
      res = engine(invContrast.data, invContrast.width, invContrast.height, { inversionAttempts: "dontInvert" });
    }
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 4
      };
    }

    // ──────────────────────────────────────────────────────────
    // PASS 5: Resolution Upscaling (2x Bilinear Interpolation)
    // ──────────────────────────────────────────────────────────
    const upscaledImg = processUpscale2x(baseImg);
    res = engine(upscaledImg.data, upscaledImg.width, upscaledImg.height, { inversionAttempts: "dontInvert" });
    if (!res || !res.data) {
      const { imageData: upscaledContrast } = processGrayscaleAndContrast(upscaledImg);
      res = engine(upscaledContrast.data, upscaledContrast.width, upscaledContrast.height, { inversionAttempts: "dontInvert" });
    }
    if (res && res.data && res.data.trim()) {
      const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
      return {
        success: true,
        mode: "qr",
        text: res.data.trim(),
        elapsedMs,
        pass: 5
      };
    }

    // ──────────────────────────────────────────────────────────
    // PASS 6: Rotation (90, 180, 270 degrees)
    // ──────────────────────────────────────────────────────────
    const rotationAngles = [90, 180, 270];
    for (const angle of rotationAngles) {
      const rotImg = rotateImageData(baseImg, angle);
      res = engine(rotImg.data, rotImg.width, rotImg.height, { inversionAttempts: "dontInvert" });
      if (!res || !res.data) {
        // If direct rotation fails, try contrast stretch on rotated image
        const { imageData: rotContrast } = processGrayscaleAndContrast(rotImg);
        res = engine(rotContrast.data, rotContrast.width, rotContrast.height, { inversionAttempts: "dontInvert" });
      }
      if (!res || !res.data) {
        // In case of rotated Dark Mode QR
        const rotInverted = processColorInversion(rotImg);
        res = engine(rotInverted.data, rotInverted.width, rotInverted.height, { inversionAttempts: "dontInvert" });
      }
      if (res && res.data && res.data.trim()) {
        const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
        return {
          success: true,
          mode: "qr",
          text: res.data.trim(),
          elapsedMs,
          pass: 6
        };
      }
    }

    // All 6 passes exhausted
    const elapsedMs = Math.round(((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - startTime);
    return {
      success: false,
      mode: "qr",
      error: "Không phát hiện được mã QR trong vùng chọn sau 6 pass xử lý nâng cao.",
      elapsedMs
    };
  }

  /**
   * Decodes QR from an HTML Canvas element.
   *
   * @param {HTMLCanvasElement} canvas
   * @returns {Object} Decode result
   */
  function decodeFromCanvas(canvas) {
    if (!canvas || !canvas.getContext) {
      return {
        success: false,
        mode: "qr",
        error: "Canvas không hợp lệ.",
        elapsedMs: 0
      };
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decodeFromImageData(imageData);
  }

  /**
   * Asynchronously decodes QR from a dataURL string (PNG, JPEG, WebP).
   * Composites the image onto a white background canvas.
   *
   * @param {string} dataUrl
   * @returns {Promise<Object>} Decode result
   */
  async function decodeQRFromDataUrl(dataUrl) {
    return new Promise((resolve) => {
      if (!dataUrl || typeof dataUrl !== "string") {
        resolve({
          success: false,
          mode: "qr",
          error: "DataUrl rỗng hoặc không hợp lệ.",
          elapsedMs: 0
        });
        return;
      }

      // In Browser environment with Image & Canvas
      if (typeof Image !== "undefined" && typeof document !== "undefined") {
        const img = new Image();
        img.onload = () => {
          try {
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });

            // Composite white background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, w, h);
            const result = decodeFromImageData(imageData);
            resolve(result);
          } catch (err) {
            resolve({
              success: false,
              mode: "qr",
              error: err.message || "Lỗi xử lý canvas.",
              elapsedMs: 0
            });
          }
        };

        img.onerror = () => {
          resolve({
            success: false,
            mode: "qr",
            error: "Không thể nạp dữ liệu ảnh dataURL.",
            elapsedMs: 0
          });
        };

        img.src = dataUrl;
      } else {
        resolve({
          success: false,
          mode: "qr",
          error: "Môi trường không hỗ trợ HTMLImageElement.",
          elapsedMs: 0
        });
      }
    });
  }

  return {
    decodeQRFromDataUrl,
    decodeFromCanvas,
    decodeFromImageData,
    ensureWhiteBackground,
    processGrayscaleAndContrast,
    processOtsuBinarization,
    processLocalAdaptiveBinarization,
    processColorInversion,
    processUpscale2x,
    rotateImageData
  };
});
