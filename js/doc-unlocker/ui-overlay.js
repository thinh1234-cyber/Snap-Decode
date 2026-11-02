// ═══════════════════════════════════════════════════════════
// UI-OVERLAY.JS — Shared UI Components for DocUnlocker
// Minimalist Floating Action Badge & Focus Progress HUD
// ═══════════════════════════════════════════════════════════

(() => {
  let escListener = null;

  window.__SnapDocUI = {
    injectFloatingButton(onClick) {
      if (document.getElementById("snap-doc-floating-btn")) return;

      const btn = document.createElement("button");
      btn.id = "snap-doc-floating-btn";
      btn.type = "button";
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span style="letter-spacing: -0.01em;">Tải PDF</span>
      `;
      btn.setAttribute("style", `
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483640 !important;
        background: #0f172a !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
        border-radius: 99px !important;
        padding: 10px 18px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        cursor: pointer !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1), background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease !important;
        user-select: none !important;
      `);

      btn.addEventListener("mouseenter", () => {
        btn.style.transform = "translateY(-2px)";
        btn.style.background = "#1e293b";
        btn.style.borderColor = "rgba(59, 130, 246, 0.5)";
        btn.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.15)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "translateY(0)";
        btn.style.background = "#0f172a";
        btn.style.borderColor = "rgba(255, 255, 255, 0.16)";
        btn.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.1)";
      });

      btn.addEventListener("click", onClick);

      // Ensure print styles completely hide floating button across all websites
      if (!document.getElementById("snap-doc-shared-print-style")) {
        const pStyle = document.createElement("style");
        pStyle.id = "snap-doc-shared-print-style";
        pStyle.textContent = `
          @media print {
            #snap-doc-floating-btn,
            #snap-doc-overlay {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          }
        `;
        document.head.appendChild(pStyle);
      }

      window.addEventListener("beforeprint", () => {
        btn.style.setProperty("display", "none", "important");
      });
      window.addEventListener("afterprint", () => {
        btn.style.setProperty("display", "flex", "important");
      });

      const appendBtn = () => {
        if (document.body && !document.getElementById("snap-doc-floating-btn")) {
          document.body.appendChild(btn);
        }
      };

      if (document.body) {
        appendBtn();
      } else {
        window.addEventListener("DOMContentLoaded", appendBtn);
      }
    },

    showProgress(title, initialStatus) {
      if (document.getElementById("snap-doc-overlay")) return;

      const overlay = document.createElement("div");
      overlay.id = "snap-doc-overlay";
      overlay.innerHTML = `
        <div style="
          position: fixed !important; top: 0 !important; left: 0 !important;
          width: 100vw !important; height: 100vh !important;
          background: rgba(11, 15, 23, 0.72) !important;
          backdrop-filter: blur(6px) !important;
          z-index: 2147483647 !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif !important;
          user-select: none !important;
        ">
          <div style="
            position: relative !important;
            background: #ffffff !important;
            width: 370px !important; max-width: 90% !important;
            border-radius: 14px !important;
            border: 1px solid #e2e8f0 !important;
            padding: 26px 24px 22px !important;
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25) !important;
            text-align: center !important;
            color: #0f172a !important;
          ">
            <button id="snap-doc-close-btn" type="button" style="
              position: absolute !important; top: 12px !important; right: 12px !important;
              background: transparent !important; border: none !important; font-size: 16px !important;
              color: #94a3b8 !important; cursor: pointer !important; padding: 4px 8px !important;
              border-radius: 6px !important; line-height: 1 !important; transition: all 0.15s ease !important;
            " title="Hủy bỏ (Esc)">✕</button>
            
            <div style="
              width: 42px !important; height: 42px !important; margin: 0 auto 12px !important;
              border-radius: 9px !important; background: #eff6ff !important; color: #2563eb !important;
              display: flex !important; align-items: center !important; justify-content: center !important;
            ">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>

            <h3 id="snap-doc-title" style="
              margin: 0 0 4px !important; font-size: 15px !important;
              font-weight: 700 !important; letter-spacing: -0.01em !important; color: #0f172a !important;
            "></h3>

            <p id="snap-doc-status" style="
              margin: 0 0 16px !important; font-size: 12.5px !important;
              color: #64748b !important; line-height: 1.45 !important;
            "></p>
            
            <div style="
              background: #f1f5f9 !important; height: 6px !important;
              border-radius: 99px !important; overflow: hidden !important;
              margin-bottom: 14px !important; border: 1px solid #e2e8f0 !important;
            ">
              <div id="snap-doc-bar" style="
                width: 0% !important; height: 100% !important;
                background: #2563eb !important; border-radius: 99px !important;
                transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
              "></div>
            </div>
            
            <span style="color: #94a3b8 !important; font-size: 11px !important;">
              Giữ nguyên tab hiện tại trong quá trình render PDF
            </span>
          </div>
        </div>
      `;

      // Safe DOM assignment prevents XSS attacks
      const titleEl = overlay.querySelector("#snap-doc-title");
      if (titleEl) titleEl.textContent = title || "";

      const statusEl = overlay.querySelector("#snap-doc-status");
      if (statusEl) statusEl.textContent = initialStatus || "";

      const closeBtn = overlay.querySelector("#snap-doc-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.hideProgress());
        closeBtn.addEventListener("mouseenter", () => {
          closeBtn.style.color = "#0f172a";
          closeBtn.style.background = "#f1f5f9";
        });
        closeBtn.addEventListener("mouseleave", () => {
          closeBtn.style.color = "#94a3b8";
          closeBtn.style.background = "transparent";
        });
      }

      // Escape key listener prevents deadlock on network errors
      if (escListener) {
        window.removeEventListener("keydown", escListener);
      }
      escListener = (e) => {
        if (e.key === "Escape") {
          this.hideProgress();
        }
      };
      window.addEventListener("keydown", escListener);

      document.body.appendChild(overlay);
    },

    updateProgress(status, percent) {
      const statusEl = document.getElementById("snap-doc-status");
      const barEl = document.getElementById("snap-doc-bar");
      if (statusEl) statusEl.textContent = status;
      if (barEl) barEl.style.width = `${percent}%`;
    },

    hideProgress() {
      if (escListener) {
        window.removeEventListener("keydown", escListener);
        escListener = null;
      }
      const overlay = document.getElementById("snap-doc-overlay");
      if (overlay) overlay.remove();
    }
  };
})();
