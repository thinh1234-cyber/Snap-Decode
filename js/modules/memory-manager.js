// ═══════════════════════════════════════════════════════════
// MEMORY-MANAGER.JS — Quản lý lịch sử Snap Decode
// ═══════════════════════════════════════════════════════════

const MEMORY_KEY = "snap_history";
const DEFAULT_MAX_ENTRIES = 50;

async function getMaxEntries() {
  try {
    const result = await chrome.storage.sync.get({ memoryLimit: DEFAULT_MAX_ENTRIES });
    return result.memoryLimit || DEFAULT_MAX_ENTRIES;
  } catch (e) {
    return DEFAULT_MAX_ENTRIES;
  }
}

async function saveHistoryToStorage(history) {
  try {
    await chrome.storage.local.set({ [MEMORY_KEY]: history });
  } catch (error) {
    console.error("[MemoryManager] Error writing to storage (quota check):", error);
    const isQuotaError = error && (
      error.name === "QuotaExceededError" ||
      (typeof error.message === "string" && (
        error.message.includes("QUOTA_BYTES") ||
        error.message.toLowerCase().includes("quota")
      ))
    );

    if (isQuotaError && history.length > 1) {
      try {
        console.warn("[MemoryManager] Quota exceeded. Pruning older history entries...");
        const pruned = history.slice(0, Math.max(1, Math.floor(history.length / 2)));
        await chrome.storage.local.set({ [MEMORY_KEY]: pruned });
        return;
      } catch (pruneError) {
        console.error("[MemoryManager] Quota recovery failed:", pruneError);
        throw pruneError;
      }
    }
    throw error;
  }
}

export async function saveSnap(entry) {
  const history = await getHistory();
  const maxEntries = await getMaxEntries();

  const contentText = entry.text || entry.ocrText || entry.translation || "";
  const mode = entry.mode === "qr" ? "qr" : "ocr";

  // Tiết kiệm bộ nhớ storage: không nhân bản các trường thừa ocrText và translation
  history.unshift({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    mode: mode,
    text: contentText,
    sourceUrl: entry.sourceUrl || "",
    confidence: entry.confidence || 0
  });

  if (history.length > maxEntries) {
    history.length = maxEntries;
  }

  await saveHistoryToStorage(history);
  return history;
}

export async function getHistory() {
  try {
    const result = await chrome.storage.local.get(MEMORY_KEY);
    return result[MEMORY_KEY] || [];
  } catch (error) {
    console.error("[MemoryManager] Error reading history:", error);
    return [];
  }
}

export async function deleteSnap(id) {
  const history = await getHistory();
  const filtered = history.filter(entry => entry.id !== id);
  await saveHistoryToStorage(filtered);
  return filtered;
}

export async function clearHistory() {
  await saveHistoryToStorage([]);
  return [];
}

export async function searchHistory(query) {
  const history = await getHistory();
  if (!query || !query.trim()) return history;

  const lowerQuery = query.toLowerCase();
  return history.filter(entry => {
    const textToSearch = (entry.text || entry.ocrText || entry.translation || "").toLowerCase();
    return textToSearch.includes(lowerQuery);
  });
}

export async function setMaxEntries(limit) {
  const clamped = Math.max(10, Math.min(500, limit));
  try {
    await chrome.storage.sync.set({ memoryLimit: clamped });
  } catch (e) {
    console.error("[MemoryManager] Error setting memory limit in sync storage:", e);
  }

  const history = await getHistory();
  if (history.length > clamped) {
    history.length = clamped;
    await saveHistoryToStorage(history);
  }
  return clamped;
}

export async function getMaxEntriesSetting() {
  return await getMaxEntries();
}
