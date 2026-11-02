document.addEventListener("DOMContentLoaded", () => {
  // ── Tab Switching ──────────────────────────────────────────
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function switchTab(tabId) {
    if (!tabId) return;
    const targetBtn = Array.from(tabBtns).find(b => b.dataset.tab === tabId);
    const targetContent = document.getElementById(`tab-${tabId}`);

    if (targetBtn && targetContent) {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      targetBtn.classList.add("active");
      targetContent.classList.add("active");

      if (tabId === "memory") {
        loadMemoryHistory();
        loadMemoryLimit();
        updateAnalytics();
      }
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Handle URL hash routing (e.g. options.html#memory)
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    switchTab(hash);
  }

  // ── General Settings (Theme, Sync) ─────────────────────────
  const themeToggle = document.getElementById("theme-toggle");
  const saveBtn = document.getElementById("save-btn");
  const saveMsg = document.getElementById("save-msg");
  const openShortcutsLink = document.getElementById("open-shortcuts-link");

  chrome.storage.sync.get({
    theme: "light"
  }, (data) => {
    const isDark = data.theme === "dark";
    if (themeToggle) themeToggle.checked = isDark;
    applyTheme(isDark);
  });

  if (themeToggle) {
    themeToggle.addEventListener("change", () => {
      const isDark = themeToggle.checked;
      applyTheme(isDark);
      chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
      chrome.runtime.sendMessage({ action: "THEME_CHANGED", theme: isDark ? "dark" : "light" }).catch(() => {});
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (saveMsg) {
        saveMsg.style.display = "block";
        setTimeout(() => { saveMsg.style.display = "none"; }, 2000);
      }
    });
  }

  if (openShortcutsLink) {
    openShortcutsLink.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    });
  }

  // ── Engine Status Check ─────────────────────────────────────
  const checkBackendBtn = document.getElementById("check-backend-btn");
  const backendHealthLabel = document.getElementById("backend-health-label");

  function checkEngineStatus() {
    if (backendHealthLabel) {
      backendHealthLabel.textContent = "✅ In-Browser JS Engine Hoạt Động Tốt (100% Client-side)";
      backendHealthLabel.style.color = "var(--snap-opt-success)";
    }
  }

  if (checkBackendBtn) {
    checkBackendBtn.addEventListener("click", checkEngineStatus);
  }

  // ── Memory & History Functionality ─────────────────────────
  const memorySearch = document.getElementById("memory-search");
  const memoryList = document.getElementById("memory-list");
  const memoryClearBtn = document.getElementById("memory-clear-btn");
  const memoryCount = document.getElementById("memory-count");
  const memoryLimitDisplay = document.getElementById("memory-limit-display");
  const memoryLimitInput = document.getElementById("memory-limit-input");

  function loadMemoryHistory(query = "") {
    const action = query ? "SEARCH_SNAP_HISTORY" : "GET_SNAP_HISTORY";
    const request = query ? { action, query } : { action: "GET_SNAP_HISTORY" };

    chrome.runtime.sendMessage(request, (entries) => {
      if (!chrome.runtime.lastError && entries && entries.length > 0) {
        updateMemoryStats(entries);
        memoryList.innerHTML = entries.map(entry => {
          const date = new Date(entry.timestamp);
          const timeStr = date.toLocaleString('vi-VN');
          const isQR = entry.mode === "qr";
          const modeLabel = isQR ? "QR Code" : "OCR Text";
          const modeClass = isQR ? "qr" : "translate";
          const previewText = entry.text || "(Không có nội dung)";

          return `
            <div class="memory-entry" data-id="${escapeAttr(entry.id)}">
              <div class="memory-entry-header">
                <span class="memory-entry-time">${escapeHtml(timeStr)}</span>
                <span class="memory-entry-mode ${modeClass}">${escapeHtml(modeLabel)}</span>
              </div>
              <div class="memory-entry-text">${escapeHtml(previewText)}</div>
              <div class="memory-entry-actions">
                <button class="copy-btn" data-text="${escapeAttr(previewText)}" type="button">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>Sao chép</span>
                </button>
                <button class="delete-btn" data-id="${escapeAttr(entry.id)}" type="button">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                  <span>Xóa</span>
                </button>
              </div>
            </div>
          `;
        }).join('');

        memoryList.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const text = btn.getAttribute('data-text');
            navigator.clipboard.writeText(text).then(() => {
              const span = btn.querySelector('span');
              if (span) span.textContent = 'Đã sao chép!';
              btn.style.borderColor = 'var(--snap-opt-success)';
              btn.style.color = 'var(--snap-opt-success)';
              setTimeout(() => {
                if (span) span.textContent = 'Sao chép';
                btn.style.borderColor = '';
                btn.style.color = '';
              }, 1800);
            });
          });
        });

        memoryList.querySelectorAll('.delete-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            chrome.runtime.sendMessage({ action: "DELETE_SNAP", id }, () => {
              loadMemoryHistory(memorySearch?.value || "");
              updateAnalytics();
            });
          });
        });
      } else {
        memoryList.innerHTML = '<div class="memory-empty">Chưa có bản ghi nào trong lịch sử giải mã.</div>';
        if (memoryCount) memoryCount.textContent = "0";
      }
    });
  }

  function updateMemoryStats(entries) {
    if (memoryCount) memoryCount.textContent = entries.length;
  }

  function loadMemoryLimit() {
    chrome.runtime.sendMessage({ action: "GET_MEMORY_LIMIT" }, (limit) => {
      if (!chrome.runtime.lastError && limit) {
        if (memoryLimitDisplay) memoryLimitDisplay.textContent = limit;
        if (memoryLimitInput) memoryLimitInput.value = limit;
      }
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  let searchTimeout;
  if (memorySearch) {
    memorySearch.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadMemoryHistory(memorySearch.value);
      }, 250);
    });
  }

  if (memoryClearBtn) {
    memoryClearBtn.addEventListener("click", () => {
      if (confirm("Xóa toàn bộ lịch sử giải mã? Thao tác này không thể hoàn tác.")) {
        chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, () => {
          loadMemoryHistory();
          updateAnalytics();
        });
      }
    });
  }

  if (memoryLimitInput) {
    memoryLimitInput.addEventListener("change", () => {
      let val = parseInt(memoryLimitInput.value, 10);
      if (isNaN(val) || val < 10) val = 10;
      if (val > 500) val = 500;
      memoryLimitInput.value = val;

      chrome.runtime.sendMessage({ action: "SET_MEMORY_LIMIT", limit: val }, (res) => {
        if (res && res.success) {
          if (memoryLimitDisplay) memoryLimitDisplay.textContent = res.limit;
          loadMemoryHistory();
        }
      });
    });
  }

  // ── Cloud Sync & Backup ────────────────────────────────────
  function dateStr() { return new Date().toISOString().slice(0, 10); }

  function showSyncMsg(msg) {
    const el = document.getElementById("sync-msg");
    if (!el) return;
    el.textContent = msg;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 3500);
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showSyncMsg(`Đã xuất file ${filename}`);
  }

  document.getElementById("export-settings-btn")?.addEventListener("click", () => {
    chrome.storage.sync.get({
      theme: "light",
      memoryLimit: 50,
      hasSeenOnboarding: false
    }, (data) => {
      downloadFile(JSON.stringify(data, null, 2), `snap-decode-settings-${dateStr()}.json`, "application/json");
    });
  });

  document.getElementById("import-settings-btn")?.addEventListener("click", () => {
    document.getElementById("import-settings-file")?.click();
  });

  document.getElementById("import-settings-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.storage.sync.set(data, () => {
          showSyncMsg("Đã nhập cài đặt thành công!");
          setTimeout(() => location.reload(), 1200);
        });
      } catch(err) {
        showSyncMsg("File JSON không hợp lệ: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("export-memory-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (entries) => {
      downloadFile(JSON.stringify(entries || [], null, 2), `snap-decode-memory-${dateStr()}.json`, "application/json");
    });
  });

  // Export CSV
  document.getElementById("export-memory-csv-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (entries) => {
      if (!entries || entries.length === 0) {
        showSyncMsg("Lịch sử đang trống, không có dữ liệu để xuất.");
        return;
      }

      // RFC 4180 CSV with UTF-8 BOM
      const header = ["ID", "Thời gian", "Loại", "Nội dung", "URL Nguồn"];
      const escapeCsv = (val) => `"${String(val || "").replace(/"/g, '""')}"`;

      const rows = entries.map(item => [
        escapeCsv(item.id),
        escapeCsv(new Date(item.timestamp).toLocaleString("vi-VN")),
        escapeCsv(item.mode === "qr" ? "QR Code" : "OCR Text"),
        escapeCsv(item.text),
        escapeCsv(item.sourceUrl || "")
      ].join(","));

      const csvContent = "\uFEFF" + [header.join(","), ...rows].join("\r\n");
      downloadFile(csvContent, `snap-decode-history-${dateStr()}.csv`, "text/csv;charset=utf-8;");
    });
  });

  document.getElementById("import-memory-btn")?.addEventListener("click", () => {
    document.getElementById("import-memory-file")?.click();
  });

  document.getElementById("import-memory-file")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target.result);
        if (!Array.isArray(raw)) {
          throw new Error("Dữ liệu lịch sử phải là một danh sách JSON (Array).");
        }

        const sanitized = raw.slice(0, 500).map((item, index) => {
          if (!item || typeof item !== "object") return null;

          const rawId = typeof item.id === "string" || typeof item.id === "number" ? String(item.id) : "";
          const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || `${Date.now()}_${index}`;

          const timestamp = item.timestamp && !isNaN(new Date(item.timestamp).getTime())
            ? new Date(item.timestamp).toISOString()
            : new Date().toISOString();

          const mode = item.mode === "qr" ? "qr" : "ocr";
          const text = String(item.text || item.ocrText || item.translation || "").slice(0, 50000);
          const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl.slice(0, 2048) : "";
          const confidence = typeof item.confidence === "number"
            ? Math.max(0, Math.min(1, item.confidence))
            : 0;

          return {
            id,
            timestamp,
            mode,
            text,
            sourceUrl,
            confidence
          };
        }).filter(Boolean);

        chrome.storage.local.set({ snap_history: sanitized }, () => {
          if (chrome.runtime.lastError) {
            showSyncMsg("Lỗi lưu trữ: " + chrome.runtime.lastError.message);
            return;
          }
          showSyncMsg(`Đã nhập thành công ${sanitized.length} mục lịch sử!`);
          loadMemoryHistory();
          updateAnalytics();
        });
      } catch(err) {
        showSyncMsg("File JSON không hợp lệ: " + err.message);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  });

  // ── Analytics Dashboard ────────────────────────────────────
  let analyticsRange = "week";

  document.querySelectorAll(".analytics-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".analytics-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      analyticsRange = btn.dataset.range;
      updateAnalytics();
    });
  });

  function updateAnalytics(entries) {
    if (!entries) {
      chrome.runtime.sendMessage({ action: "GET_SNAP_HISTORY" }, (data) => {
        updateAnalytics(data || []);
      });
      return;
    }

    const now = new Date();
    let filtered = entries;

    if (analyticsRange === "week") {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      filtered = entries.filter(e => new Date(e.timestamp) >= weekAgo);
    } else if (analyticsRange === "month") {
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      filtered = entries.filter(e => new Date(e.timestamp) >= monthAgo);
    }

    const totalEl = document.getElementById("analytics-total");
    const ocrEl = document.getElementById("analytics-ocr");
    const qrEl = document.getElementById("analytics-qr");
    const charsEl = document.getElementById("analytics-chars");

    if (totalEl) totalEl.textContent = filtered.length;
    if (ocrEl) ocrEl.textContent = filtered.filter(e => e.mode !== "qr").length;
    if (qrEl) qrEl.textContent = filtered.filter(e => e.mode === "qr").length;

    const totalChars = filtered.reduce((sum, e) => {
      const text = e.text || "";
      return sum + text.length;
    }, 0);

    if (charsEl) {
      charsEl.textContent = totalChars > 9999 ? (totalChars / 1000).toFixed(1) + "K" : totalChars;
    }
  }
});

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
