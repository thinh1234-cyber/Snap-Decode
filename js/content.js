// ═══════════════════════════════════════════════════════════
// CONTENT.JS — Snap Decode (Lightweight Client Bridge)
// 2 Core Features: High-precision OCR & Fast QR Code Decoder
// ═══════════════════════════════════════════════════════════

(() => {
  window.snapDecodeInjected = true;

  // Clean up any previous listener if extension was reloaded without page refresh
  if (window.__snapDecodeListener) {
    try {
      chrome.runtime.onMessage.removeListener(window.__snapDecodeListener);
    } catch (e) {}
  }

  let startX, startY;
  let isSnapping = false;
  let overlay, selectionBox;
  let currentSnapMode = "qr"; // "qr"
  let popup;

  // ── Message Listener ───────────────────────────────────────
  const messageListener = (request, sender, sendResponse) => {
    if (request.action === "PING") {
      sendResponse({ status: "PONG" });
      return true;
    }

    if (request.action === "START_SNAP") {
      currentSnapMode = "qr";
      initSnapOverlay();
      sendResponse({ status: "STARTED" });
      return true;
    }

    if (request.action === "THEME_CHANGED") {
      applyTheme(request.theme);
      return;
    }
  };

  window.__snapDecodeListener = messageListener;
  chrome.runtime.onMessage.addListener(messageListener);

  chrome.storage.sync.get({ theme: "light" }, (data) => {
    applyTheme(data.theme);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ── Snap Overlay & Region Selection ────────────────────────
  function initSnapOverlay() {
    const prevOverlay = document.getElementById("snap-decode-overlay") || document.getElementById("snap-translate-overlay");
    if (prevOverlay) {
      prevOverlay.remove();
    }

    const container = document.fullscreenElement || document.body;

    overlay = document.createElement("div");
    overlay.id = "snap-translate-overlay";
    overlay.className = "snap-translate-overlay";
    overlay.style.cursor = "crosshair";

    selectionBox = document.createElement("div");
    selectionBox.id = "snap-translate-selection";
    selectionBox.className = "snap-translate-selection";
    selectionBox.style.cursor = "crosshair";
    selectionBox.style.display = "none";

    overlay.appendChild(selectionBox);
    container.appendChild(overlay);

    overlay.addEventListener("mousedown", onMouseDown);
    overlay.addEventListener("mousemove", onMouseMove);
    overlay.addEventListener("mouseup", onMouseUp);

    document.addEventListener("keydown", onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      removeOverlay();
    }
  }

  function onMouseDown(e) {
    isSnapping = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";
    selectionBox.style.display = "block";
  }

  function onMouseMove(e) {
    if (!isSnapping) return;
    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
  }

  function onMouseUp(e) {
    if (!isSnapping) return;
    isSnapping = false;

    const rect = selectionBox.getBoundingClientRect();
    removeOverlay();

    if (rect.width > 20 && rect.height > 20) {
      processSnap(rect);
    }
  }

  function removeOverlay() {
    isSnapping = false;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    const o1 = document.getElementById("snap-translate-overlay");
    if (o1) o1.remove();
    const o2 = document.getElementById("snap-decode-overlay");
    if (o2) o2.remove();
    document.removeEventListener("keydown", onKeyDown);
  }

  // ── Capture & Process Crop (Bridge to Python Backend) ──────
  async function processSnap(rect) {
    // 1. Chụp màn hình NGAY LẬP TỨC trước khi vẽ popup để ảnh không bị che
    chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (response) => {
      if (chrome.runtime.lastError) {
        showPopupLoading();
        updatePopupError("Lỗi kết nối nền: " + chrome.runtime.lastError.message, true);
        return;
      }

      if (!response || !response.dataUrl) {
        showPopupLoading();
        updatePopupError(response?.error || "Không thể chụp màn hình trang web.", true);
        return;
      }

      // 2. Hiện popup loader sau khi đã chụp ảnh xong
      showPopupLoading();
      updatePopupLoadingText("Đang định vị & giải mã QR Code...");

      // 3. Cắt ảnh và gửi sang Backend
      cropAndDispatchToBackend(response.dataUrl, rect);
    });
  }

  function cropAndDispatchToBackend(dataUrl, rect) {
    const img = new Image();
    img.onload = async () => {
      // Tỷ lệ scale thực giữa bitmap chụp và viewport (sử dụng clientWidth/clientHeight để tránh dính thanh cuộn)
      const clientWidth = document.documentElement.clientWidth || window.innerWidth;
      const clientHeight = document.documentElement.clientHeight || window.innerHeight;

      const scaleX = img.naturalWidth / clientWidth;
      const scaleY = img.naturalHeight / clientHeight;

      const rawX = Math.round(rect.left * scaleX);
      const rawY = Math.round(rect.top * scaleY);
      const rawW = Math.round(rect.width * scaleX);
      const rawH = Math.round(rect.height * scaleY);

      // Clamp tọa độ bảo đảm không âm và không vượt quá kích thước bitmap ảnh gốc
      const cropX = Math.max(0, Math.min(rawX, img.naturalWidth - 1));
      const cropY = Math.max(0, Math.min(rawY, img.naturalHeight - 1));
      const cropWidth = Math.max(1, Math.min(rawW, img.naturalWidth - cropX));
      const cropHeight = Math.max(1, Math.min(rawH, img.naturalHeight - cropY));

      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      const croppedDataUrl = canvas.toDataURL("image/png");

      // 1. Client-side In-Browser Fast Decode via SnapQRDecoder (15-40ms)
      if (currentSnapMode === "qr" && window.SnapQRDecoder) {
        try {
          const clientResult = window.SnapQRDecoder.decodeFromCanvas(canvas);
          if (clientResult && clientResult.success && clientResult.text) {
            const decodedText = clientResult.text.trim();
            chrome.runtime.sendMessage({
              action: "SAVE_SNAP",
              entry: {
                mode: currentSnapMode,
                text: decodedText,
                sourceUrl: window.location.href
              }
            });

            updatePopupResult(currentSnapMode, decodedText, croppedDataUrl, clientResult.elapsedMs);
            return;
          }
        } catch (err) {
          console.warn("[SnapDecode] Client-side QR decode error:", err);
        }
      }

      // 2. Không phát hiện được mã QR trong vùng chọn
      updatePopupError("Không phát hiện được mã QR hợp lệ trong vùng chọn. Hãy thử kéo chọn rộng hơn hoặc rõ nét hơn nhé!", true);
    };
    img.src = dataUrl;
  }

  // ── Result & UI Rendering ──────────────────────────────────
  function createPopupContainer() {
    if (document.getElementById("snap-decode-popup")) {
      document.getElementById("snap-decode-popup").remove();
    }

    const container = document.fullscreenElement || document.body;

    popup = document.createElement("div");
    popup.id = "snap-decode-popup";
    popup.className = "snap-translate-popup";

    const header = document.createElement("div");
    header.id = "snap-decode-header";
    header.className = "snap-translate-header";
    header.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span id="snap-guide-btn" title="Hướng dẫn sử dụng" style="cursor:pointer; display:flex; align-items:center; color:var(--snap-text-secondary); opacity:0.9;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
        </span>
        <span id="snap-settings-btn" title="Mở trang Cài đặt" style="cursor:pointer; display:flex; align-items:center; color:var(--snap-text-secondary); opacity:0.9;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </span>
        <span style="font-weight:600; font-size:13.5px; letter-spacing:-0.01em;">Snap Decode</span>
      </div>
      <button id="snap-decode-close" class="snap-translate-close" title="Đóng">&times;</button>
    `;

    const content = document.createElement("div");
    content.id = "snap-decode-content";
    content.className = "snap-translate-content";

    popup.appendChild(header);
    popup.appendChild(content);
    container.appendChild(popup);

    document.getElementById("snap-decode-close").addEventListener("click", () => {
      popup.remove();
    });

    document.getElementById("snap-settings-btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "OPEN_OPTIONS" });
    });

    document.getElementById("snap-guide-btn").addEventListener("click", () => {
      showOnboarding();
    });

    makeDraggable(popup, header);
  }

  function showPopupLoading() {
    createPopupContainer();
    const content = document.getElementById("snap-decode-content");
    content.innerHTML = `
      <div class="snap-loader">
        <div class="snap-spinner"></div>
        <span id="snap-loading-text">Đang chuẩn bị...</span>
      </div>
      <div style="text-align: center; margin-top: 15px;">
        <button id="snap-cancel-btn" style="background:#d93025; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">✖ Hủy</button>
      </div>
    `;

    document.getElementById("snap-cancel-btn").addEventListener("click", () => {
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
    });
  }

  function updatePopupLoadingText(text) {
    const textEl = document.getElementById("snap-loading-text");
    if (textEl) {
      textEl.innerText = text;
    }
  }

  function updatePopupResult(mode, decodedText, croppedDataUrl, elapsedMs) {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    const labelTitle = "Nội dung mã QR";
    const modeBadge = "QR Code • Engine";
    const badgeBg = "rgba(16, 185, 129, 0.12)";
    const badgeColor = "var(--snap-success, #10b981)";

    const charCount = decodedText.length;
    const wordCount = decodedText.split(/\s+/).filter(Boolean).length;
    const speedText = elapsedMs !== undefined ? ` • ${elapsedMs}ms` : "";
    const statsText = `${charCount} ký tự • ${wordCount} từ${speedText}`;

    let safeText = escapeHtml(decodedText);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    safeText = safeText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--snap-link, #2563eb); text-decoration: underline; word-break: break-all;">$1</a>');

    content.innerHTML = `
      <div class="snap-translate-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="snap-translate-label" style="margin-bottom:0;">${labelTitle}</span>
          <span style="font-size:10.5px; font-weight:600; padding:2px 7px; border-radius:4px; background:${badgeBg}; color:${badgeColor}; font-family:ui-monospace, monospace;">${modeBadge}</span>
        </div>
        <div class="snap-translate-text" style="white-space: pre-wrap; max-height:260px; overflow-y:auto; user-select:text;">${safeText}</div>
        <div style="margin-top:6px; font-size:11px; color:var(--snap-text-secondary, #64748b); text-align:right;">${statsText}</div>
      </div>

      <div style="display:flex; justify-content:center; gap:8px; margin-top:14px;">
        <button id="snap-copy-btn" type="button" style="
          background: var(--snap-primary, #2563eb); color: white;
          border: none; padding: 7px 14px; border-radius: 6px;
          cursor: pointer; font-size: 12.5px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.15s;
        ">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span id="snap-copy-label">Sao chép</span>
        </button>

        <button id="snap-export-btn" type="button" style="
          background: var(--snap-bg-secondary, #f8fafc); color: var(--snap-text, #0f172a);
          border: 1px solid var(--snap-border, #e2e8f0); padding: 7px 12px;
          border-radius: 6px; cursor: pointer; font-size: 12.5px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.15s;
        ">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span id="snap-export-label">Xuất .txt</span>
        </button>

        <button id="snap-resnap-btn" type="button" style="
          background: var(--snap-bg-secondary, #f8fafc); color: var(--snap-text, #0f172a);
          border: 1px solid var(--snap-border, #e2e8f0); padding: 7px 12px;
          border-radius: 6px; cursor: pointer; font-size: 12.5px; font-weight: 500;
          display: inline-flex; align-items: center; gap: 6px; transition: 0.15s;
        ">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>Quét lại</span>
        </button>
      </div>
    `;

    // Copy Event
    document.getElementById("snap-copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(decodedText).then(() => {
        const label = document.getElementById("snap-copy-label");
        if (label) label.textContent = 'Đã sao chép!';
        setTimeout(() => { if (label) label.textContent = 'Sao chép'; }, 1800);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = decodedText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const label = document.getElementById("snap-copy-label");
        if (label) label.textContent = 'Đã sao chép!';
        setTimeout(() => { if (label) label.textContent = 'Sao chép'; }, 1800);
      });
    });

    // Export Event
    document.getElementById("snap-export-btn").addEventListener("click", () => {
      const timestamp = new Date().toLocaleString('vi-VN');
      const headerTag = currentSnapMode === "qr" ? "MÃ QR" : "VĂN BẢN TRÍCH XUẤT OCR";
      const exportContent = `=== Snap Decode ===\nThời gian: ${timestamp}\nChế độ: ${headerTag}\n\n[NỘI DUNG]\n${decodedText}\n`;
      const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snap-decode-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      const label = document.getElementById("snap-export-label");
      if (label) label.textContent = 'Đã tải xong!';
      setTimeout(() => { if (label) label.textContent = 'Xuất .txt'; }, 1800);
    });

    // Resnap Event
    document.getElementById("snap-resnap-btn").addEventListener("click", () => {
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
      initSnapOverlay();
    });
  }

  function updatePopupError(errorMsg, canResnap = true) {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    content.innerHTML = `
      <div class="snap-translate-section">
        <div class="snap-translate-label" style="color:var(--snap-danger, #d93025);">Thông Báo</div>
        <div class="snap-translate-text" style="color:var(--snap-danger-text, #ba1a1a); background:var(--snap-danger-bg, #fce8e6); border-color:var(--snap-danger-border, #fad2cf);">
          ${escapeHtml(errorMsg)}
        </div>
      </div>
      ${canResnap ? `
        <div style="text-align:center; margin-top:14px;">
          <button id="snap-error-resnap-btn" style="
            background: var(--snap-primary, #1a73e8); color: white; border: none;
            padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
          ">🔄 Thử Snap lại</button>
        </div>
      ` : ''}
    `;

    if (canResnap) {
      document.getElementById("snap-error-resnap-btn").addEventListener("click", () => {
        if (document.getElementById("snap-decode-popup")) {
          document.getElementById("snap-decode-popup").remove();
        }
        initSnapOverlay();
      });
    }
  }

  function showOnboarding() {
    const content = document.getElementById("snap-decode-content");
    if (!content) return;

    content.innerHTML = `
      <div style="padding:4px 0;">
        <h3 style="margin:0 0 12px; font-size:15px; color:var(--snap-primary, #1a73e8);">📖 Hướng dẫn Snap Decode</h3>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:18px;">🔍</span>
            <div>
              <strong style="font-size:13px;">1. Snap Trích Xuất Chữ (OCR)</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Nhấn phím tắt <code style="background:var(--snap-border, #dadce0); padding:1px 4px; border-radius:3px;">Alt+X</code> hoặc mở extension chọn "Snap OCR", kéo chọn vùng chứa chữ để trích xuất văn bản offline.</p>
            </div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start; padding:10px; background:var(--snap-bg-secondary, #f8f9fa); border-radius:8px;">
            <span style="font-size:18px;">📷</span>
            <div>
              <strong style="font-size:13px;">2. Snap Quét Mã QR</strong>
              <p style="margin:4px 0 0; font-size:12px; color:var(--snap-text-secondary, #5f6368);">Mở popup chọn "Snap Đọc QR", kéo chuột bao quanh mã QR trên màn hình. Nội dung link hoặc mã token sẽ được tự động định vị và giải mã ngay lập tức.</p>
            </div>
          </div>
        </div>
        <div style="text-align:center; margin-top:14px;">
          <button id="snap-onboarding-close" style="
            background:var(--snap-primary, #1a73e8); color:white; border:none;
            padding:7px 20px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;
          ">Đã hiểu ✓</button>
        </div>
      </div>
    `;

    document.getElementById("snap-onboarding-close").addEventListener("click", () => {
      chrome.storage.sync.set({ hasSeenOnboarding: true });
      if (document.getElementById("snap-decode-popup")) {
        document.getElementById("snap-decode-popup").remove();
      }
    });
  }

  function escapeHtml(unsafe) {
    return String(unsafe || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function makeDraggable(elmnt, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.addEventListener("mousedown", dragMouseDown);

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener("mouseup", closeDragElement);
      document.addEventListener("mousemove", elementDrag);
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
      elmnt.style.right = "auto";
    }

    function closeDragElement() {
      document.removeEventListener("mouseup", closeDragElement);
      document.removeEventListener("mousemove", elementDrag);
    }
  }

  // Show onboarding on first use
  chrome.storage.sync.get({ hasSeenOnboarding: false }, (data) => {
    if (!data.hasSeenOnboarding) {
      setTimeout(() => {
        createPopupContainer();
        showOnboarding();
      }, 500);
    }
  });
})();
