function storageGet(keyOrKeys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keyOrKeys, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(result);
    });
  });
}

export async function getApiKeys() {
  const { api_keys } = await storageGet("api_keys");
  return api_keys || {};
}

export async function getConfigFromDisk() {
  const { translation_config } = await storageGet("translation_config");
  return translation_config || null;
}

export async function getActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(tabs[0] || null);
    });
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

export async function querySiteSupported(tabId) {
  const response = await sendMessageToTab(tabId, {
    type: "site.supported",
  });

  if (!response || !response.ok) {
    // If you want to be defensive:
    // console.warn("[popup] site.supported failed:", response?.error);
    return false;
  }

  return Boolean(response.supported);
}

/**
 * Queries current pipeline state from the content script.
 * Expects content script to respond to: { type: 'getProgressState' }
 *
 * Recommended response shape:
 * {
 *   ok: true,
 *   state: {
 *     status: 'idle' | 'running' | 'complete_success' | 'complete_error' | 'warning_pending',
 *     progress: { ... } | null,
 *     error: { message: string } | null,
 *     warning: { ... } | null
 *   }
 * }
 */
export async function getPipelineState(tabId) {
  const response = await sendMessageToTab(tabId, { type: "getProgressState" });
  if (!response || !response.ok) {
    return null;
  }
  return response.state || null;
}

/**
 * Starts the translation pipeline.
 * Expects content script handler for: { type: 'pipeline.start', payload }
 */
export async function startPipeline(tabId, payload) {
  const response = await sendMessageToTab(tabId, {
    type: "pipeline.start",
    payload,
  });
  if (!response || !response.ok) {
    throw new Error(response?.error || "Failed to start pipeline");
  }
}

/**
 * Continues the pipeline after a warning confirmation.
 * Expects content script handler for: { type: 'pipeline.continue' }
 */
export async function continuePipeline(tabId) {
  const response = await sendMessageToTab(tabId, {
    type: "pipeline.continue",
  });
  if (!response || !response.ok) {
    throw new Error(response?.error || "Failed to continue pipeline");
  }
}

/**
 * Asks content script to show the glossary widget.
 */
export async function showGlossaryWidget(tabId) {
  await sendMessageToTab(tabId, { type: "glossary.showWidget" });
}

/**
 * Asks content script to show a text preview (for unsupported sites).
 */
export async function showPreview(tabId) {
  await sendMessageToTab(tabId, { type: "preview.show" });
}

/**
 * Opens the extension options page.
 */
export function openOptionsPage() {
  void chrome.runtime.openOptionsPage();
}
