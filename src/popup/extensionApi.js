import { POPUP_MSG_TYPE } from "../common/messaging.js";

function storageGet(keyOrKeys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keyOrKeys, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Session-scoped storage for per-tab overrides
function storageSessionGet(keyOrKeys) {
  return new Promise((resolve, reject) => {
    // Fallback for environments without storage.session (rare in MV3 but safe)
    const area = chrome.storage.session || chrome.storage.local;
    area.get(keyOrKeys, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function storageSessionSet(obj) {
  return new Promise((resolve, reject) => {
    const area = chrome.storage.session || chrome.storage.local;
    area.set(obj, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve();
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
  const response = await sendMessageToTab(tabId, { type: POPUP_MSG_TYPE.site_supported });

  if (!response || !response.ok) {
    // If you want to be defensive:
    // console.warn("[popup] site.supported failed:", response?.error);
    return false;
  }

  return Boolean(response.supported);
}

/**
 * Returns: { status: 'IDLE' | 'RUNNING' | ..., error: ..., warning: ... }
 */
export async function getPipelineLifecycleState(tabId) {
  const response = await sendMessageToTab(tabId, { type: POPUP_MSG_TYPE.pipeline_getState });
  if (!response || !response.success) {
    // Fallback to IDLE if content script is not ready
    return { status: "IDLE" };
  }
  return response.state || { status: "IDLE" };
}

/**
 * Gets the granular LLM progress metrics.
 * Only call this when lifecycle status is 'RUNNING'.
 */
export async function getLlmProgress(tabId) {
  const response = await sendMessageToTab(tabId, { type: POPUP_MSG_TYPE.get_progress_state });
  if (!response || !response.success) {
    return null;
  }
  return response.data || null;
}

/**
 * Starts the translation pipeline.
 * Expects content script handler for: { type: 'pipeline.start', payload }
 */
export async function startPipeline(tabId, payload) {
  const response = await sendMessageToTab(tabId, {
    type: POPUP_MSG_TYPE.pipeline_start,
    payload,
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || "Failed to start pipeline");
  }

  return response;
}

/**
 * Continues the pipeline after a warning confirmation.
 * Expects content script handler for: { type: 'pipeline.continue' }
 */
export async function continuePipeline(tabId) {
  const response = await sendMessageToTab(tabId, {
    type: POPUP_MSG_TYPE.pipeline_continue
  });
  if (!response || !response.ok) {
    throw new Error(response?.error || "Failed to continue pipeline");
  }
}

/**
 * Asks content script to show the glossary widget.
 */
export async function showGlossaryWidget(tabId) {
  await sendMessageToTab(tabId, { type: POPUP_MSG_TYPE.glossary_showWidget });
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

/**
 * Per-tab language overrides.
 * Stored as: { "popup_lang_overrides": { "TAB_ID": { popupSourceLang: '...', popupTargetLang: '...' } } }
 */
export async function getPopupLanguageOverrides(tabId) {
  if (!tabId && tabId !== 0) return {};
  const { popup_lang_overrides } = await storageSessionGet("popup_lang_overrides");
  const all = popup_lang_overrides || {};
  return all[String(tabId)] || {};
}

export async function setPopupLanguageOverrides(tabId, overrides) {
  if (!tabId && tabId !== 0) return;
  const key = String(tabId);
  const { popup_lang_overrides } = await storageSessionGet("popup_lang_overrides");
  const all = popup_lang_overrides || {};

  if (!overrides || (!overrides.popupSourceLang && !overrides.popupTargetLang)) {
    delete all[key];
  } else {
    all[key] = {
      popupSourceLang: overrides.popupSourceLang,
      popupTargetLang: overrides.popupTargetLang,
    };
  }
  await storageSessionSet({ popup_lang_overrides: all });
}
