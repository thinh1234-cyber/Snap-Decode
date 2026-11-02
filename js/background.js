// ═══════════════════════════════════════════════════════════
// BACKGROUND.JS — Message Router & Orchestrator (Snap Decode)
// Supports Native Messaging (Auto-start & Auto-shutdown) + HTTP Fallback
// ═══════════════════════════════════════════════════════════

import { registerCommandListener } from './modules/snap-controller.js';
import {
  saveSnap,
  getHistory,
  deleteSnap,
  clearHistory,
  searchHistory,
  setMaxEntries,
  getMaxEntriesSetting
} from './modules/memory-manager.js';

// ── Register command listener (Alt+X) ─────────────────────
registerCommandListener();

// ── Message Router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "CAPTURE_SCREEN": {
      const windowId = sender.tab ? sender.tab.windowId : null;
      chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          const errMsg = chrome.runtime.lastError?.message || "Không thể chụp màn hình tab hiện tại.";
          console.error("[SnapDecode SW] Capture failed:", errMsg);
          sendResponse({ dataUrl: null, error: errMsg });
        } else {
          sendResponse({ dataUrl: dataUrl });
        }
      });
      return true;
    }

    case "START_DOC_DOWNLOAD": {
      const tab = request.tab;
      if (!tab || !tab.url) {
        sendResponse({ success: false, error: "Không tìm thấy thông tin tab." });
        return true;
      }

      const url = tab.url;
      if (url.includes("scribd.com")) {
        const isEmbed = url.includes("/embeds/");
        const docMatch = url.match(/\/(?:document|doc|presentation|slideshow|article|read)\/(\d+)/i) ||
                         url.match(/\/(\d{6,})(?:[/?#]|$)/);
        if (docMatch && !isEmbed) {
          const docId = docMatch[1];
          const embedUrl = `https://www.scribd.com/embeds/${docId}/content?start_page=1&view_mode=scroll#snap_autodownload=1`;
          chrome.tabs.create({ url: embedUrl });
          sendResponse({ success: true, redirect: true });
        } else {
          chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_DOC_DOWNLOAD" }, () => {
            sendResponse({ success: true });
          });
        }
      } else if (url.includes("studocu.com") || url.includes("studocu.vn") || url.includes("studeersnel.nl") || url.includes("slideshare.net") || url.includes("slideserve.com")) {
        chrome.tabs.sendMessage(tab.id, { action: "TRIGGER_DOC_DOWNLOAD" }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({
          success: false,
          error: "Trang hiện tại không phải Scribd, StuDocu, SlideShare hoặc SlideServe!\nHãy mở trang tài liệu cần tải trước."
        });
      }
      return true;
    }

    case "THEME_CHANGED":
      chrome.tabs.query({}, (tabs) => {
        if (!chrome.runtime.lastError && tabs) {
          for (const tab of tabs) {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, {
                action: "THEME_CHANGED",
                theme: request.theme
              }, () => {
                void chrome.runtime.lastError;
              });
            }
          }
        }
      });
      sendResponse({ success: true });
      return true;

    case "OPEN_OPTIONS":
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage(() => {
          if (chrome.runtime.lastError) {
            chrome.tabs.create({ url: chrome.runtime.getURL('html/options.html') }, () => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/options.html') }, () => {
          sendResponse({ success: true });
        });
      }
      return true;

    case "SAVE_SNAP":
      saveSnap(request.entry)
        .then(history => {
          sendResponse({ success: true, count: history.length });
        })
        .catch(err => {
          console.error("[SnapDecode SW] SAVE_SNAP failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case "GET_SNAP_HISTORY":
      getHistory()
        .then(history => {
          sendResponse(history);
        })
        .catch(err => {
          console.error("[SnapDecode SW] GET_SNAP_HISTORY failed:", err);
          sendResponse([]);
        });
      return true;

    case "SEARCH_SNAP_HISTORY":
      searchHistory(request.query)
        .then(results => {
          sendResponse(results);
        })
        .catch(err => {
          console.error("[SnapDecode SW] SEARCH_SNAP_HISTORY failed:", err);
          sendResponse([]);
        });
      return true;

    case "DELETE_SNAP":
      deleteSnap(request.id)
        .then(history => {
          sendResponse({ success: true, count: history.length });
        })
        .catch(err => {
          console.error("[SnapDecode SW] DELETE_SNAP failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case "CLEAR_HISTORY":
      clearHistory()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(err => {
          console.error("[SnapDecode SW] CLEAR_HISTORY failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case "SET_MEMORY_LIMIT":
      setMaxEntries(request.limit)
        .then(newLimit => {
          sendResponse({ success: true, limit: newLimit });
        })
        .catch(err => {
          console.error("[SnapDecode SW] SET_MEMORY_LIMIT failed:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case "GET_MEMORY_LIMIT":
      getMaxEntriesSetting()
        .then(limit => {
          sendResponse(limit);
        })
        .catch(err => {
          console.error("[SnapDecode SW] GET_MEMORY_LIMIT failed:", err);
          sendResponse(50);
        });
      return true;

    default:
      return false;
  }
});
