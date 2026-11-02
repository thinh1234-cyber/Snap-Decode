// ═══════════════════════════════════════════════════════════
// DOC-UNLOCKER/INDEX.JS — Main Orchestrator / Caller Module
// Coordinates UI and routes execution to registered site providers
// ═══════════════════════════════════════════════════════════

(() => {
  const providers = [
    window.__SnapDocScribd,
    window.__SnapDocStudocu,
    window.__SnapDocSlideShare,
    window.__SnapDocSlideServe
  ].filter(Boolean);

  window.__SnapDocRouter = {
    getProvider() {
      const host = window.location.hostname;
      return providers.find(p => p && p.isMatch(host));
    },

    dispatch() {
      const provider = this.getProvider();
      if (provider) {
        provider.execute(window.__SnapDocUI);
      } else {
        alert("Trang hiện tại không thuộc danh sách hỗ trợ (Scribd, StuDocu, SlideShare, SlideServe)!");
      }
    },

    init() {
      const provider = this.getProvider();
      if (!provider) return;

      // 1. Inject Floating Action Button on matched sites
      window.__SnapDocUI.injectFloatingButton(() => {
        this.dispatch();
      });

      // 2. Check auto-download trigger (safe polling mechanism replaces fixed setTimeout)
      if (window.location.hash.includes("snap_autodownload=1")) {
        const waitForReadyAndDispatch = () => {
          const startTime = Date.now();
          const maxWaitMs = 12000;
          const pollInterval = 150;

          const checkReady = () => {
            // Check core container/page readiness for Scribd (.outer_page, .newpage, #outer_page_1 or docManager has data),
            // StuDocu (#page-container, .pf), SlideShare, or SlideServe (#player, #tscript, .ss-header-wrapper)
            const isScribdReady = !!(
              document.querySelector(".outer_page, .newpage, #outer_page_1") ||
              (typeof window !== "undefined" && window.docManager && (window.docManager.pageCount || (window.docManager.pages && Object.keys(window.docManager.pages).length > 0))) ||
              document.documentElement.getAttribute("data-snap-scribd-total")
            );
            const isStudocuReady = !!document.querySelector("#page-container, [data-page-index], .pf, .p2hv");
            const isSlideShareReady = !!document.querySelector("#__NEXT_DATA__, [data-testid='total-slides'], img[data-testid*='slide'], .slide");
            const isSlideServeReady = !!document.querySelector("#player, #tscript, .ss-header-wrapper");

            const isReady = isScribdReady || isStudocuReady || isSlideShareReady || isSlideServeReady;

            if (isReady || (Date.now() - startTime) >= maxWaitMs) {
              this.dispatch();
            } else {
              setTimeout(checkReady, pollInterval);
            }
          };

          checkReady();
        };

        if (document.readyState === "complete" || document.readyState === "interactive") {
          waitForReadyAndDispatch();
        } else {
          window.addEventListener("DOMContentLoaded", waitForReadyAndDispatch);
        }
      }
    }
  };

  // Auto-init router on page load
  window.__SnapDocRouter.init();
})();
