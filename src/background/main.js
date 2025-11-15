/**
 * Background service worker entry point.
 * Minimal message router that delegates to appropriate handlers.
 */
import { LLMCoordinator } from "./llm-coordinator.js";

const BG_MSG_TYPES = {
  llm_request: 'llm_request',
  llm_cancel: 'llm_cancel',
  get_models: 'get_models',
  refresh_models: 'refresh_models',
  clear_model_cache: 'clear_model_cache',
};

// Initialize coordinator for LLM external calls
const coordinator = new LLMCoordinator();

/**
 * Message handler for chrome.runtime.sendMessage from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // LLM completion request
  if (message.type === BG_MSG_TYPES.llm_request) {
    void coordinator.handleRequest(message.payload, sendResponse);
    return true; // Keep channel open for async response
  }

  // LLM cancellation request
  if (message.type === BG_MSG_TYPES.llm_cancel) {
    coordinator.handleCancel(message.payload);
    return false; // No response needed
  }

  // Get model list
  if (message.type === BG_MSG_TYPES.get_models) {
    coordinator.getModelList(message.payload)
      .then(models => {
        sendResponse({ ok: true, data: models });
      })
      .catch(error => {
        sendResponse({ ok: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Refresh model list from providers
  if (message.type === BG_MSG_TYPES.refresh_models) {
    coordinator.refreshModelList()
      .then(results => {
        sendResponse({ ok: true, data: results });
      })
      .catch(error => {
        sendResponse({ ok: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Clear model cache
  if (message.type === BG_MSG_TYPES.clear_model_cache) {
    coordinator.clearModelCache()
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch(error => {
        sendResponse({ ok: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  // Unknown message type
  console.warn('[Background] Unknown message type:', message.type);
  return false;
});

// Open options menu from right click on icon
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-options',
    title: 'Open Extension Settings',
    contexts: ['action'] // Right-click on the extension icon
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'open-options') {
    void chrome.runtime.openOptionsPage();
  }
});


console.log('[Background] Service worker started');

self.addEventListener('beforeunload', () => {
  console.log('[Background] Service worker terminating...');
});