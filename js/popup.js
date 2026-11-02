document.addEventListener("DOMContentLoaded", () => {
  // ── Sync Theme ─────────────────────────────────────────────
  chrome.storage.sync.get({ theme: "light" }, (data) => {
    document.documentElement.setAttribute('data-theme', data.theme);
  });

  // ── Engine Status Indicator ────────────────────────────────
  const statusDot = document.getElementById("server-status-dot");
  const statusText = document.getElementById("server-status");
  const modeBadge = document.getElementById("server-mode-badge");

  function initEngineStatus() {
    if (!statusDot || !statusText) return;
    statusDot.className = "status-dot";
    statusText.textContent = "Sẵn sàng (In-Browser Engine)";
    if (modeBadge) modeBadge.textContent = "100% Client-side";
  }

  initEngineStatus();

  // ── Load Recent Snap Snippet ───────────────────────────────
  const recentEmpty = document.getElementById("recent-snap-empty");
  const recentContent = document.getElementById("recent-snap-content");
  const recentTextEl = document.getElementById("recent-text");
  const recentTimeEl = document.getElementById("recent-time");
  const recentBadgeEl = document.getElementById("recent-badge");
  const recentCopyBtn = document.getElementById("recent-copy-btn");
  const recentCopyText = document.getElementById("recent-copy-text");
  const viewAllHistory = document.getElementById("view-all-history");

  let latestDecodedText = "";

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "Vừa xong";
    const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Date(timestamp).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" });
  }

  function loadRecentHistory() {
    chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (history) => {
      if (!chrome.runtime.lastError && history && history.length > 0) {
        const latest = history[0];
        latestDecodedText = latest.text || "";
        
        if (recentEmpty) recentEmpty.style.display = "none";
        if (recentContent) recentContent.style.display = "flex";
        if (recentTextEl) recentTextEl.textContent = latestDecodedText || "(Không có nội dung)";
        if (recentTimeEl) recentTimeEl.textContent = formatRelativeTime(latest.timestamp);
        if (recentBadgeEl) {
          recentBadgeEl.textContent = latest.mode === "qr" ? "QR Code" : "OCR Text";
        }
      } else {
        if (recentEmpty) recentEmpty.style.display = "block";
        if (recentContent) recentContent.style.display = "none";
      }
    });
  }

  loadRecentHistory();

  if (recentCopyBtn) {
    recentCopyBtn.addEventListener("click", () => {
      if (!latestDecodedText) return;
      navigator.clipboard.writeText(latestDecodedText).then(() => {
        if (recentCopyText) recentCopyText.textContent = "Đã sao chép!";
        recentCopyBtn.style.borderColor = "var(--snap-status-success)";
        recentCopyBtn.style.color = "var(--snap-status-success)";
        setTimeout(() => {
          if (recentCopyText) recentCopyText.textContent = "Sao chép";
          recentCopyBtn.style.borderColor = "";
          recentCopyBtn.style.color = "";
        }, 1800);
      });
    });
  }

  if (viewAllHistory) {
    viewAllHistory.addEventListener("click", (e) => {
      e.preventDefault();
      openOptionsPage("memory");
    });
  }

  // ── Snap Execution Bridge ──────────────────────────────────
  async function executeSnap(mode) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length > 0) {
        let tab = tabs[0];
        if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://")) {
          alert("Không thể chụp trên các trang cài đặt hệ thống của trình duyệt!");
          return;
        }
        try {
          await injectAndStartSnap(tab, mode);
        } catch (e) {
          console.error("[SnapDecode Popup] Snap failed:", e);
        }
        window.close();
      }
    });
  }

  async function isContentScriptReady(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "PING" }, (response) => {
        if (chrome.runtime.lastError || !response || response.status !== "PONG") {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  async function injectAndStartSnap(tab, mode) {
    try {
      const ready = await isContentScriptReady(tab.id);

      if (!ready) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["css/content.css"] });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["js/lib/jsqr.js", "js/modules/qr-decoder.js", "js/content.js"]
        });
      }

      chrome.tabs.sendMessage(tab.id, { action: "START_SNAP", mode: mode });
    } catch (e) {
      console.error("[SnapDecode Popup] Failed to start snap:", e);
      if (tab.url.startsWith("file://")) {
        alert("Hãy cấp quyền 'Allow access to file URLs' trong trang quản lý Extension để chụp các file lưu trên máy nhé!");
      } else {
        alert("Lỗi: Không thể khởi tạo snap trên trang này. Hãy thử tải lại trang web.");
      }
    }
  }

  // ── Button Bindings ────────────────────────────────────────
  const qrBtn = document.getElementById("snap-qr-btn");
  if (qrBtn) {
    qrBtn.addEventListener("click", () => {
      executeSnap("qr");
    });
  }

  const docsBtn = document.getElementById("docs-download-btn");
  if (docsBtn) {
    docsBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.runtime.sendMessage({ action: "START_DOC_DOWNLOAD", tab: tabs[0] }, (resp) => {
            if (resp && resp.error) {
              alert(resp.error);
            } else {
              window.close();
            }
          });
        }
      });
    });
  }

  function openOptionsPage(targetTab = null) {
    const url = targetTab ? `html/options.html#${targetTab}` : 'html/options.html';
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL(url));
    }
  }

  document.getElementById("options-btn")?.addEventListener("click", () => {
    openOptionsPage();
  });

  document.getElementById("guide-btn")?.addEventListener("click", () => {
    showGuideOverlay();
  });

  // ── Minimalist In-Page Onboarding Guide ────────────────────
  function showGuideOverlay() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: injectGuide
        });
      }
    });
    window.close();
  }

  function injectGuide() {
    if (document.getElementById("snap-guide-overlay")) {
      document.getElementById("snap-guide-overlay").remove();
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "snap-guide-overlay";
    overlay.innerHTML = `
      <style>
        #snap-guide-overlay {
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          background: rgba(11, 15, 23, 0.72) !important;
          backdrop-filter: blur(6px) !important;
          z-index: 2147483647 !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif !important;
          user-select: none !important;
        }
        #snap-guide-overlay .snap-guide-container {
          background: #ffffff !important; border-radius: 14px !important;
          border: 1px solid #e2e8f0 !important;
          padding: 28px 24px 22px !important; max-width: 400px !important; width: 90% !important;
          position: relative !important; box-shadow: 0 20px 50px rgba(0,0,0,0.25) !important;
          text-align: center !important; color: #0f172a !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-container {
          background: #111827 !important; border-color: #1f293d !important; color: #f8fafc !important;
        }
        #snap-guide-overlay .snap-guide-close {
          position: absolute !important; top: 12px !important; right: 14px !important;
          background: none !important; border: none !important; font-size: 18px !important;
          cursor: pointer !important; color: #94a3b8 !important; padding: 4px 8px !important;
          border-radius: 6px !important; line-height: 1 !important; transition: all 0.15s ease !important;
        }
        #snap-guide-overlay .snap-guide-close:hover {
          color: #0f172a !important; background: #f1f5f9 !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-close:hover {
          color: #ffffff !important; background: #1e293b !important;
        }
        #snap-guide-overlay .snap-guide-icon {
          width: 44px !important; height: 44px !important; margin: 0 auto 14px !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          background: #eff6ff !important; color: #2563eb !important; border-radius: 10px !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-icon {
          background: rgba(59, 130, 246, 0.12) !important; color: #3b82f6 !important;
        }
        #snap-guide-overlay .snap-guide-step h3 {
          margin: 0 0 8px !important; font-size: 16px !important; font-weight: 600 !important;
          letter-spacing: -0.01em !important;
        }
        #snap-guide-overlay .snap-guide-step p {
          margin: 0 !important; font-size: 13px !important; line-height: 1.55 !important;
          color: #64748b !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-step p {
          color: #94a3b8 !important;
        }
        #snap-guide-overlay .snap-guide-step kbd {
          background: #f1f5f9 !important; border: 1px solid #cbd5e1 !important;
          border-radius: 4px !important; padding: 2px 5px !important; font-size: 11px !important;
          font-family: inherit !important; font-weight: 600 !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-step kbd {
          background: #1e293b !important; border-color: #374151 !important; color: #f8fafc !important;
        }
        #snap-guide-overlay .snap-guide-nav {
          display: flex !important; justify-content: space-between !important;
          align-items: center !important; margin-top: 24px !important;
        }
        #snap-guide-overlay .snap-guide-nav button {
          background: #2563eb !important; color: #ffffff !important; border: none !important;
          padding: 8px 16px !important; border-radius: 6px !important; cursor: pointer !important;
          font-size: 13px !important; font-weight: 500 !important; transition: opacity 0.15s ease !important;
        }
        #snap-guide-overlay .snap-guide-nav button:hover { opacity: 0.92 !important; }
        #snap-guide-overlay .snap-guide-dots { display: flex !important; gap: 6px !important; }
        #snap-guide-overlay .snap-guide-dots .dot {
          width: 7px !important; height: 7px !important; border-radius: 50% !important;
          background: #cbd5e1 !important; cursor: pointer !important; transition: all 0.15s ease !important;
        }
        [data-theme="dark"] #snap-guide-overlay .snap-guide-dots .dot { background: #374151 !important; }
        #snap-guide-overlay .snap-guide-dots .dot.active {
          background: #2563eb !important; transform: scale(1.2) !important;
        }
      </style>
      <div class="snap-guide-container">
        <button class="snap-guide-close" id="snap-guide-close">✕</button>
        <div class="snap-guide-step" data-step="1">
          <div class="snap-guide-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M3 17v2a2 2 0 0 0 2 2h2"></path>
              <rect x="7" y="7" width="10" height="10" rx="1"></rect>
            </svg>
          </div>
          <h3>Bước 1: Quét mã QR màn hình</h3>
          <p>Nhấn phím <kbd>Alt</kbd>+<kbd>X</kbd> hoặc click nút Quét QR, kéo chọn vùng có mã QR để nhận kết quả giải mã tức thì.</p>
        </div>
        <div class="snap-guide-step" data-step="2" style="display:none;">
          <div class="snap-guide-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          </div>
          <h3>Bước 2: Mở khóa tài liệu trực tuyến</h3>
          <p>Tại các trang tài liệu như Scribd, StuDocu, SlideShare hoặc SlideServe, click nút nổi <b>Tải PDF</b> hoặc nút Tải Tài Liệu trong popup.</p>
        </div>
        <div class="snap-guide-step" data-step="3" style="display:none;">
          <div class="snap-guide-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </div>
          <h3>Bước 3: Sao chép & Quản lý lịch sử</h3>
          <p>Kết quả giải mã tự động lưu vào bộ nhớ. Bạn có thể sao chép nhanh hoặc vào Cài đặt để xuất danh sách JSON / CSV.</p>
        </div>
        <div class="snap-guide-nav">
          <button id="snap-guide-prev" style="visibility:hidden;">← Trước</button>
          <span class="snap-guide-dots">
            <span class="dot active" data-dot="1"></span>
            <span class="dot" data-dot="2"></span>
            <span class="dot" data-dot="3"></span>
          </span>
          <button id="snap-guide-next">Tiếp →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let currentStep = 1;
    const totalSteps = 3;

    function showStep(step) {
      overlay.querySelectorAll(".snap-guide-step").forEach(s => s.style.display = "none");
      overlay.querySelector(`.snap-guide-step[data-step="${step}"]`).style.display = "block";
      overlay.querySelectorAll(".dot").forEach(d => d.classList.toggle("active", d.dataset.dot == step));
      document.getElementById("snap-guide-prev").style.visibility = step === 1 ? "hidden" : "visible";
      document.getElementById("snap-guide-next").textContent = step === totalSteps ? "✓ Hoàn tất" : "Tiếp →";
    }

    document.getElementById("snap-guide-close").addEventListener("click", () => overlay.remove());
    document.getElementById("snap-guide-next").addEventListener("click", () => {
      if (currentStep >= totalSteps) { overlay.remove(); return; }
      currentStep++;
      showStep(currentStep);
    });
    document.getElementById("snap-guide-prev").addEventListener("click", () => {
      if (currentStep <= 1) return;
      currentStep--;
      showStep(currentStep);
    });
    overlay.querySelectorAll(".dot").forEach(dot => {
      dot.addEventListener("click", () => {
        currentStep = parseInt(dot.dataset.dot);
        showStep(currentStep);
      });
    });
  }
});
