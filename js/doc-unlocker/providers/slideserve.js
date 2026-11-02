// ═══════════════════════════════════════════════════════════
// PROVIDERS/SLIDESERVE.JS — SlideServe Downloader & PDF Engine
// Dynamic multi-tier HD slide extraction (HD 1024px -l.jpg):
// Tier 1: window.doc_data / custom-cache script
// Tier 2: Transcript #tscript li a[href*="-l.jpg"]
// Tier 3: DOM player / #fsimg / carousel srcset + vid + totalSlides pattern generator
// Controlled parallel downloading (Concurrency = 6) with in-tab dark modal UI & A4 Landscape print engine
// ═══════════════════════════════════════════════════════════

(() => {
  window.__SnapDocSlideServe = {
    name: "SlideServe",

    isMatch(host) {
      return host.includes("slideserve.com");
    },

    execute(UI) {
      this.generatePDF(UI);
    },

    // ── Document Title ────────────────────────────────────────
    getTitle(defaultTitle = "") {
      if (defaultTitle && defaultTitle.trim() && defaultTitle.trim().toLowerCase() !== "slideserve") {
        return defaultTitle.trim();
      }

      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      if (ogTitle && ogTitle.trim().toLowerCase() !== "slideserve") {
        return ogTitle.trim();
      }

      const h1 = document.querySelector("h1");
      if (h1 && h1.innerText.trim()) {
        return h1.innerText.trim();
      }

      const cleanDocTitle = (document.title || "SlideServe_Presentation")
        .replace(/\s*\|\s*SlideServe/i, "")
        .replace(/[<>:"/\\|?*]/g, "")
        .trim();

      return cleanDocTitle || "SlideServe_Presentation";
    },

    // ── Extract VID (Presentation ID) ─────────────────────────
    extractVid() {
      // 1. Hidden input #video_vid
      const vidInput = document.getElementById("video_vid") || document.querySelector('input[name="video_vid"]');
      if (vidInput && vidInput.value && /^\d+$/.test(vidInput.value.trim())) {
        return vidInput.value.trim();
      }

      // 2. Canonical or Embed link
      const canonical = document.querySelector('link[rel="canonical"]')?.href || "";
      const canonicalMatch = canonical.match(/\/(\d{5,10})(?:[/?#]|$)/);
      if (canonicalMatch) return canonicalMatch[1];

      // 3. Scan page HTML for video_vid or embed url
      const html = document.documentElement.innerHTML;
      const htmlMatch = html.match(/name=["']video_vid["'][^>]*value=["'](\d+)["']/i) ||
                        html.match(/video_vid["']?\s*[:=]\s*["']?(\d+)["']?/i) ||
                        html.match(/slideserve\.com\/embed\/(\d+)/i) ||
                        html.match(/slideserve\.com\/[^\/]+\/(\d{5,10})/i);
      if (htmlMatch) return htmlMatch[1];

      return null;
    },

    // ── Extract Total Slides Count ────────────────────────────
    extractTotalSlides() {
      // 1. Element with data-bs-number
      const bsNumberEl = document.querySelector("[data-bs-number]");
      if (bsNumberEl) {
        const num = parseInt(bsNumberEl.getAttribute("data-bs-number"), 10);
        if (num > 0) return num;
      }

      // 2. Stat pill (.ss-header-stat-pill)
      const pills = document.querySelectorAll(".ss-header-stat-pill");
      for (const pill of pills) {
        const text = pill.innerText || pill.textContent || "";
        const m = text.match(/(\d+)\s*SLIDES?/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > 0) return num;
        }
      }

      // 3. Script variables (slidesCount)
      const scripts = document.querySelectorAll("script");
      for (const s of scripts) {
        const text = s.textContent || "";
        const m = text.match(/slidesCount\s*=\s*(\d+)/i);
        if (m) {
          const num = parseInt(m[1], 10);
          if (num > 0) return num;
        }
      }

      // 4. Transcript count fallback
      const transcriptItems = document.querySelectorAll('#tscript li a[href*="-l.jpg"], #tscript a[href*="-l.jpg"]');
      if (transcriptItems.length > 0) {
        return transcriptItems.length;
      }

      return 0;
    },

    // ── Tier 1: Extract from doc_data (Global variable or cache script) ──
    async extractFromDocData(vid) {
      let dd = null;

      // 1. Direct window global check
      if (typeof window !== "undefined" && window.doc_data && Array.isArray(window.doc_data.scenes)) {
        dd = window.doc_data;
      }

      // 2. Inline script tags containing doc_data
      if (!dd) {
        const scripts = document.querySelectorAll("script");
        for (const s of scripts) {
          const text = s.textContent || "";
          if (text.includes("doc_data") && text.includes("scenes")) {
            const m = text.match(/doc_data\s*=\s*(\{[\s\S]*?\});/);
            if (m) {
              try {
                dd = JSON.parse(m[1]);
                break;
              } catch (e) {}
            }
          }
        }
      }

      // 3. Fetch custom-cache script referenced in HTML if not yet loaded
      if (!dd) {
        const html = document.documentElement.innerHTML;
        const cacheMatch = html.match(/https?:\/\/[^"'\s]*slideserve\.com\/custom-cache\/[^"'\s]*\.js/i) ||
                           html.match(/\/custom-cache\/[^"'\s]*\.js/i);
        if (cacheMatch) {
          let cacheUrl = cacheMatch[0];
          if (cacheUrl.startsWith("/")) {
            cacheUrl = `https://www.slideserve.com${cacheUrl}`;
          }
          try {
            const res = await fetch(cacheUrl);
            if (res.ok) {
              const text = await res.text();
              const m = text.match(/doc_data\s*=\s*(\{[\s\S]*?\});/);
              if (m) {
                dd = JSON.parse(m[1]);
              }
            }
          } catch (err) {
            console.warn("[SnapDoc] Could not fetch custom-cache script:", err);
          }
        }
      }

      if (dd && Array.isArray(dd.scenes) && dd.scenes.length > 0) {
        const bgPath = dd.bgPath || (vid ? `https://image1.slideserve.com/${vid}/` : "https://image1.slideserve.com/");
        const ext = dd.ext || "jpg";
        const totalSlides = dd.scenes.length;

        const slideCandidates = dd.scenes.map((scene, idx) => {
          const bg = scene.bg;
          const u1 = `${bgPath}${bg}-l.${ext}`;
          const u2 = u1.replace("image1.slideserve.com", "cdn1.slideserve.com");
          const cands = [u1, u2];
          if (vid) {
            cands.push(`https://image1.slideserve.com/${vid}/slide${idx + 1}-l.jpg`);
            cands.push(`https://cdn1.slideserve.com/${vid}/slide${idx + 1}-l.jpg`);
          }
          return Array.from(new Set(cands));
        });

        return {
          source: "doc_data",
          totalSlides,
          slideCandidates
        };
      }

      return null;
    },

    // ── Tier 2: Extract from Transcript (#tscript) ───────────
    extractFromTranscript(vid) {
      const links = Array.from(document.querySelectorAll('#tscript li a[href*="-l.jpg"], #tscript a[href*="-l.jpg"]'));
      if (links.length === 0) return null;

      const urls = [];
      links.forEach(a => {
        const h = a.href || a.getAttribute("href");
        if (h && h.includes("-l.jpg") && !urls.includes(h)) {
          urls.push(h);
        }
      });

      if (urls.length === 0) return null;

      const slideCandidates = urls.map((u, idx) => {
        const alt = u.includes("image1.slideserve.com")
          ? u.replace("image1.slideserve.com", "cdn1.slideserve.com")
          : u.replace("cdn1.slideserve.com", "image1.slideserve.com");
        const cands = [u, alt];
        if (vid) {
          cands.push(`https://image1.slideserve.com/${vid}/slide${idx + 1}-l.jpg`);
          cands.push(`https://cdn1.slideserve.com/${vid}/slide${idx + 1}-l.jpg`);
        }
        return Array.from(new Set(cands));
      });

      return {
        source: "transcript",
        totalSlides: urls.length,
        slideCandidates
      };
    },

    // ── Tier 3: Scan #fsimg / carousel + Generate Candidates from Pattern ──
    extractFromPattern(vid, totalSlides) {
      if (!vid || totalSlides <= 0) return null;

      // Check first slide image from #fsimg
      let firstSlideUrl = null;
      const fsimg = document.getElementById("fsimg") || document.querySelector("img[srcset*='-l.jpg']");
      if (fsimg) {
        const srcset = fsimg.getAttribute("srcset");
        if (srcset) {
          const parts = srcset.split(",");
          for (const p of parts) {
            const tokens = p.trim().split(/\s+/);
            if (tokens.length > 0 && tokens[0].includes("-l.jpg")) {
              firstSlideUrl = tokens[0];
              break;
            }
          }
        }
        if (!firstSlideUrl && fsimg.src && fsimg.src.includes("-l.jpg")) {
          firstSlideUrl = fsimg.src;
        }
      }

      const slideCandidates = [];
      for (let i = 1; i <= totalSlides; i++) {
        const cands = [];
        if (i === 1 && firstSlideUrl) {
          cands.push(firstSlideUrl);
          const altFirst = firstSlideUrl.includes("image1.slideserve.com")
            ? firstSlideUrl.replace("image1.slideserve.com", "cdn1.slideserve.com")
            : firstSlideUrl.replace("cdn1.slideserve.com", "image1.slideserve.com");
          cands.push(altFirst);
        }
        cands.push(`https://image1.slideserve.com/${vid}/slide${i}-l.jpg`);
        cands.push(`https://cdn1.slideserve.com/${vid}/slide${i}-l.jpg`);
        slideCandidates.push(Array.from(new Set(cands)));
      }

      return {
        source: "pattern",
        totalSlides,
        slideCandidates
      };
    },

    // ── Multi-Tier Slide Collection ───────────────────────────
    async collectSlideData(onProgress) {
      if (onProgress) onProgress(0, 0, 15, "Đang phân tích định danh và cấu trúc trình chiếu...");

      const vid = this.extractVid();
      const discoveredTotal = this.extractTotalSlides();

      // Tier 1: doc_data (scenes array)
      if (onProgress) onProgress(0, 0, 25, "Đang kiểm tra kho dữ liệu cảnh trình chiếu...");
      const tier1 = await this.extractFromDocData(vid);
      if (tier1 && tier1.totalSlides > 0) {
        console.log(`[SnapDoc] SlideServe Tier 1 (doc_data) found ${tier1.totalSlides} slides.`);
        if (onProgress) onProgress(tier1.totalSlides, tier1.totalSlides, 40, `Tìm thấy ${tier1.totalSlides} slide độ nét cao!`);
        return tier1;
      }

      // Tier 2: Transcript (#tscript)
      if (onProgress) onProgress(0, 0, 30, "Đang quét danh sách bản ghi slide transcript...");
      const tier2 = this.extractFromTranscript(vid);

      // If Tier 2 found all slides matching discoveredTotal
      if (tier2 && discoveredTotal > 0 && tier2.totalSlides >= discoveredTotal) {
        console.log(`[SnapDoc] SlideServe Tier 2 (transcript) found ${tier2.totalSlides} slides.`);
        if (onProgress) onProgress(tier2.totalSlides, tier2.totalSlides, 40, `Tìm thấy ${tier2.totalSlides} slide qua transcript!`);
        return tier2;
      }

      // Tier 3: Pattern Generator (or Hybrid Merge if Tier 2 has partial slides)
      const targetTotal = Math.max(discoveredTotal, tier2 ? tier2.totalSlides : 0);
      if (vid && targetTotal > 0) {
        if (onProgress) onProgress(0, 0, 35, "Đang khởi tạo danh mục ứng cử viên slide...");
        const tier3 = this.extractFromPattern(vid, targetTotal);

        // Merge Tier 2 URLs if available
        if (tier2 && tier2.slideCandidates) {
          tier2.slideCandidates.forEach((cands, idx) => {
            if (tier3.slideCandidates[idx]) {
              tier3.slideCandidates[idx] = Array.from(new Set([...cands, ...tier3.slideCandidates[idx]]));
            }
          });
        }

        console.log(`[SnapDoc] SlideServe Tier 3 (pattern/hybrid) generated ${tier3.totalSlides} slides.`);
        if (onProgress) onProgress(tier3.totalSlides, tier3.totalSlides, 40, `Tìm thấy ${tier3.totalSlides} slide!`);
        return tier3;
      }

      // Fallback to Tier 2 if available even without vid
      if (tier2 && tier2.totalSlides > 0) {
        return tier2;
      }

      return null;
    },

    // ── Autoscale Engine (A4 Landscape Print Format) ─────────
    applyAutoscale(container, modalUI) {
      const firstPf = container.querySelector(".pf");
      let origW = 1024;
      let origH = 768;

      const firstImg = firstPf ? firstPf.querySelector("img") : null;
      if (firstImg && firstImg.naturalWidth && firstImg.naturalHeight) {
        origW = firstImg.naturalWidth;
        origH = firstImg.naturalHeight;
      }

      // Slide presentations are standard landscape (4:3 or 16:9)
      const maxScreenW = Math.min(window.innerWidth * 0.9, 1040);
      const previewScale = Math.min(1, maxScreenW / origW);
      const displayW = Math.round(origW * previewScale);
      const displayH = Math.round(origH * previewScale);

      const allPfs = container.querySelectorAll(".pf");
      allPfs.forEach(pf => {
        pf.style.setProperty("width", `${displayW}px`, "important");
        pf.style.setProperty("height", `${displayH}px`, "important");
        pf.style.setProperty("aspect-ratio", `${origW} / ${origH}`, "important");
      });

      if (allPfs.length > 0) {
        allPfs[allPfs.length - 1].classList.add("snap-last-slide");
      }

      // Update dynamic print stylesheet: A4 Landscape exact fit
      const prevStyle = document.getElementById("snap-slideserve-autoscale-style");
      if (prevStyle) prevStyle.remove();

      const dynamicStyle = document.createElement("style");
      dynamicStyle.id = "snap-slideserve-autoscale-style";
      dynamicStyle.textContent = `
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }
          #snap-slideserve-modal {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            overflow: visible !important;
          }
          #snap-slideserve-modal .snap-modal-bar,
          #snap-slideserve-modal .snap-modal-loading {
            display: none !important;
          }
          #snap-slideserve-modal .snap-modal-pages {
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
            display: block !important;
          }
          #snap-slideserve-modal .snap-modal-pages .pf {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            background: #fff !important;
          }
          #snap-slideserve-modal .snap-modal-pages .pf.snap-last-slide,
          #snap-slideserve-modal .snap-modal-pages .pf:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          #snap-slideserve-modal .snap-modal-pages .pf img {
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
            display: block !important;
          }
          body > *:not(#snap-slideserve-modal) {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(dynamicStyle);

      if (modalUI && modalUI.printBtn) {
        modalUI.printBtn.textContent = `🖨️ In / Lưu PDF (Khổ Ngang • ${allPfs.length} slides)`;
        modalUI.printBtn.disabled = false;
        modalUI.printBtn.style.opacity = "1";
        modalUI.printBtn.classList.add("ready");
      }

      if (modalUI && modalUI.pageBadge) {
        modalUI.pageBadge.textContent = `📄 ${allPfs.length} slides`;
      }
    },

    // ── Build In-Tab Dark Modal UI ────────────────────────────
    createModal(title) {
      const modal = document.createElement("div");
      modal.id = "snap-slideserve-modal";
      modal.setAttribute("tabindex", "0");

      const bar = document.createElement("div");
      bar.className = "snap-modal-bar";

      const titleGroup = document.createElement("div");
      titleGroup.className = "snap-modal-title-group";

      const logo = document.createElement("span");
      logo.className = "snap-badge-logo";
      logo.textContent = "⚡ SnapDoc";

      const titleEl = document.createElement("div");
      titleEl.className = "snap-modal-title";
      titleEl.textContent = title;
      titleEl.setAttribute("title", title);

      const pageBadge = document.createElement("span");
      pageBadge.className = "snap-badge-count";
      pageBadge.textContent = "Đang nạp...";

      titleGroup.appendChild(logo);
      titleGroup.appendChild(titleEl);
      titleGroup.appendChild(pageBadge);

      const actions = document.createElement("div");
      actions.className = "snap-modal-actions";

      const printBtn = document.createElement("button");
      printBtn.className = "snap-btn-print";
      printBtn.textContent = "⏳ Đang chuẩn bị...";
      printBtn.disabled = true;
      printBtn.style.opacity = "0.5";
      printBtn.addEventListener("click", () => window.print());

      const closeBtn = document.createElement("button");
      closeBtn.className = "snap-btn-close";
      closeBtn.textContent = "✕ Đóng";

      const doClose = () => {
        modal.remove();
        const dynamicStyle = document.getElementById("snap-slideserve-autoscale-style");
        if (dynamicStyle) dynamicStyle.remove();
      };
      closeBtn.addEventListener("click", doClose);

      modal.addEventListener("wheel", (e) => {
        e.stopPropagation();
        modal.scrollTop += e.deltaY;
      }, { passive: false });

      modal.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          doClose();
        } else if (e.key === "ArrowDown") {
          modal.scrollTop += 90;
          e.preventDefault();
        } else if (e.key === "ArrowUp") {
          modal.scrollTop -= 90;
          e.preventDefault();
        }
      });

      actions.appendChild(printBtn);
      actions.appendChild(closeBtn);

      bar.appendChild(titleGroup);
      bar.appendChild(actions);

      const loading = document.createElement("div");
      loading.className = "snap-modal-loading";

      const track = document.createElement("div");
      track.className = "snap-bar-track";

      const fill = document.createElement("div");
      fill.className = "snap-bar-fill";
      track.appendChild(fill);

      const sub = document.createElement("div");
      sub.className = "snap-loading-sub";
      sub.style.cssText = "font-size:12px;color:#aaa;margin-top:8px;";
      sub.textContent = "Đang phân tích cấu trúc tài liệu...";

      loading.appendChild(track);
      loading.appendChild(sub);

      const pages = document.createElement("div");
      pages.className = "snap-modal-pages";

      modal.appendChild(bar);
      modal.appendChild(loading);
      modal.appendChild(pages);

      return { modal, bar, printBtn, closeBtn, loading, fill, sub, pages, pageBadge };
    },

    // ── Inject Static Overlay Styles ─────────────────────────
    injectOverlayStyles() {
      if (document.getElementById("snap-slideserve-static-style")) return;

      const style = document.createElement("style");
      style.id = "snap-slideserve-static-style";
      style.textContent = `
        #snap-slideserve-modal {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #1e1e1e !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          color: #fff !important;
          outline: none !important;
        }

        #snap-slideserve-modal .snap-modal-bar {
          position: sticky !important;
          top: 0 !important;
          z-index: 100 !important;
          background: #252526 !important;
          border-bottom: 1px solid #3c3c3c !important;
          padding: 10px 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-shrink: 0 !important;
          gap: 16px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4) !important;
        }

        #snap-slideserve-modal .snap-modal-title-group {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          overflow: hidden !important;
          flex: 1 !important;
        }

        #snap-slideserve-modal .snap-badge-logo {
          background: linear-gradient(135deg, #ff7043, #d84315) !important;
          color: #fff !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 4px 10px !important;
          border-radius: 20px !important;
          letter-spacing: 0.5px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideserve-modal .snap-modal-title {
          font-size: 14px !important;
          font-weight: 600 !important;
          color: #e0e0e0 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }

        #snap-slideserve-modal .snap-badge-count {
          background: #333333 !important;
          color: #aaa !important;
          font-size: 11px !important;
          padding: 3px 8px !important;
          border-radius: 12px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideserve-modal .snap-modal-actions {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex-shrink: 0 !important;
        }

        #snap-slideserve-modal .snap-btn-print {
          background: linear-gradient(135deg, #1a73e8, #0d47a1) !important;
          color: #fff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 18px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }

        #snap-slideserve-modal .snap-btn-print.ready:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 14px rgba(26, 115, 232, 0.5) !important;
        }

        #snap-slideserve-modal .snap-btn-close {
          background: #333333 !important;
          color: #ccc !important;
          border: 1px solid #444 !important;
          border-radius: 8px !important;
          padding: 8px 14px !important;
          font-size: 13px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }

        #snap-slideserve-modal .snap-btn-close:hover {
          background: #444 !important;
          color: #fff !important;
        }

        #snap-slideserve-modal .snap-modal-loading {
          padding: 40px 20px !important;
          text-align: center !important;
          flex-shrink: 0 !important;
        }

        #snap-slideserve-modal .snap-bar-track {
          background: #333 !important;
          height: 8px !important;
          border-radius: 4px !important;
          overflow: hidden !important;
          max-width: 420px !important;
          margin: 16px auto 10px !important;
        }

        #snap-slideserve-modal .snap-bar-fill {
          height: 100% !important;
          width: 0% !important;
          background: linear-gradient(90deg, #ff7043, #ffab40) !important;
          border-radius: 4px !important;
          transition: width 0.25s ease !important;
        }

        #snap-slideserve-modal .snap-modal-pages {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 20px !important;
          padding: 24px 0 80px !important;
          min-height: 200px !important;
        }

        #snap-slideserve-modal .snap-modal-pages .pf {
          background: #ffffff !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
          margin: 0 auto !important;
          border-radius: 4px !important;
        }

        #snap-slideserve-modal .snap-modal-pages .pf img {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          display: block !important;
        }

        @media print {
          body > *:not(#snap-slideserve-modal) {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(style);
    },

    // ── Full Pipeline Execution ───────────────────────────────
    async generatePDF(UI) {
      this.injectOverlayStyles();
      const modalUI = this.createModal("SlideServe Presentation");
      document.body.appendChild(modalUI.modal);

      // Bước 1: Thu thập metadata & danh sách URL ứng cử viên
      const presentationData = await this.collectSlideData((done, total, pct, subText) => {
        modalUI.fill.style.width = `${pct}%`;
        modalUI.sub.textContent = subText || `Đang quét dữ liệu...`;
        if (UI) UI.updateProgress(subText || `Quét dữ liệu`, pct);
      });

      if (!presentationData || !presentationData.slideCandidates || presentationData.slideCandidates.length === 0) {
        alert("SnapDoc: Không tìm thấy slide nào trên bài thuyết trình SlideServe này. Hãy thử cuộn trang hoặc tải lại trang rồi thử lại nhé!");
        modalUI.modal.remove();
        return;
      }

      const total = presentationData.totalSlides;
      const cleanTitle = this.getTitle();
      modalUI.modal.querySelector(".snap-modal-title").textContent = cleanTitle;
      modalUI.modal.querySelector(".snap-modal-title").setAttribute("title", cleanTitle);
      if (modalUI.pageBadge) modalUI.pageBadge.textContent = `0/${total} slides`;

      // Bước 2: Tạo trước các khung .pf cho từng slide
      const pfElements = [];
      const queue = [];

      presentationData.slideCandidates.forEach((candidates, idx) => {
        const pf = document.createElement("div");
        pf.className = "pf";
        pf.setAttribute("data-slide-index", (idx + 1).toString());

        const img = document.createElement("img");
        img.alt = `Slide ${idx + 1}`;
        img.setAttribute("loading", "eager");

        pf.appendChild(img);
        modalUI.pages.appendChild(pf);

        pfElements.push(pf);
        queue.push({ img, candidates, idx });
      });

      if (pfElements.length > 0) {
        pfElements[pfElements.length - 1].classList.add("snap-last-slide");
      }

      // Căn chỉnh tỷ lệ hiển thị ban đầu
      this.applyAutoscale(modalUI.pages, modalUI);

      // Bước 3: Tải ảnh song song có kiểm soát (Concurrency = 6)
      const CONCURRENCY = 6;
      let completedCount = 0;
      let successCount = 0;

      const loadSlide = (item) => {
        const { img, candidates, idx } = item;
        return new Promise((resolve) => {
          let candidateIdx = 0;
          let isSettled = false;
          let timer = null;

          const settle = (ok) => {
            if (isSettled) return;
            isSettled = true;
            if (timer) clearTimeout(timer);
            completedCount++;
            if (ok) successCount++;

            const pct = 40 + Math.round((completedCount / total) * 60);
            modalUI.fill.style.width = `${pct}%`;
            modalUI.sub.textContent = `Đang nạp ảnh slide (${completedCount} / ${total})...`;
            if (modalUI.pageBadge) modalUI.pageBadge.textContent = `${completedCount}/${total} slides`;
            if (UI) UI.updateProgress(`Nạp slide ${completedCount} / ${total}`, pct);

            if (completedCount === 1) {
              this.applyAutoscale(modalUI.pages, modalUI);
            }
            resolve(ok);
          };

          const tryCandidate = () => {
            if (isSettled) return;
            if (candidateIdx < candidates.length) {
              const url = candidates[candidateIdx++];
              img.onerror = () => tryCandidate();
              img.onload = () => {
                if (img.naturalWidth > 0) {
                  settle(true);
                } else {
                  tryCandidate();
                }
              };
              img.src = url;

              // Timeout 10s cho mỗi candidate URL
              if (timer) clearTimeout(timer);
              timer = setTimeout(() => {
                console.warn(`[SnapDoc] Slide ${idx + 1} quá hạn tải URL, thử fallback:`, url);
                tryCandidate();
              }, 10000);
            } else {
              console.warn(`[SnapDoc] Slide ${idx + 1} đã thử hết các URL khả dụng.`);
              settle(false);
            }
          };

          tryCandidate();
        });
      };

      let qIdx = 0;
      const workers = Array(CONCURRENCY).fill(null).map(async () => {
        while (qIdx < queue.length) {
          const item = queue[qIdx++];
          await loadSlide(item);
        }
      });

      await Promise.all(workers);

      // Hoàn tất nạp ảnh và kích hoạt in
      modalUI.loading.style.display = "none";
      this.applyAutoscale(modalUI.pages, modalUI);

      if (successCount === total) {
        modalUI.sub.textContent = `✅ Đã sẵn sàng in đầy đủ ${total} slide!`;
        // Tự động mở hộp thoại in sau nhịp nghỉ ngắn khi 100% ảnh hợp lệ
        setTimeout(() => {
          if (modalUI.printBtn) modalUI.printBtn.click();
        }, 600);
      } else if (successCount > 0) {
        modalUI.sub.textContent = `⚠️ Chỉ tải được ${successCount}/${total} slide. Một số trang bị lỗi mạng.`;
        if (modalUI.printBtn) {
          modalUI.printBtn.textContent = `🖨️ In slide khả dụng (${successCount}/${total} slides)`;
        }
        alert(`SnapDoc cảnh báo: Chỉ tải thành công ${successCount}/${total} slide (có ${total - successCount} slide bị lỗi). Vui lòng kiểm tra trên màn hình trước khi in!`);
      } else {
        modalUI.sub.textContent = `❌ Không tải được hình ảnh slide nào.`;
        if (modalUI.printBtn) {
          modalUI.printBtn.disabled = true;
          modalUI.printBtn.style.opacity = "0.5";
          modalUI.printBtn.textContent = "❌ Lỗi tải slide";
        }
        alert("SnapDoc: Không tải được hình ảnh slide nào trên SlideServe. Vui lòng kiểm tra lại kết nối mạng và thử lại!");
      }
    }
  };
})();
