/**
 * Background service worker entry point.
 * Minimal message router that delegates to appropriate handlers.
 */
import { LLMCoordinator } from "./llm-coordinator.js";
import {
  getGlossaryFromDB,
  saveGlossaryToDB,
  deleteGlossaryFromDB,
  scanAllKeysFromDB,
} from './indexeddb-storage.js';

const BG_MSG_TYPES = {
  llm_request: 'llm_request',
  llm_cancel: 'llm_cancel',
  get_models: 'get_models',
  refresh_models: 'refresh_models',
  clear_model_cache: 'clear_model_cache',
  get_glossary: 'idb.get_glossary',
  save_glossary: 'idb.save_glossary',
  delete_glossary: 'idb.delete_glossary',
  scan_glossary_keys: 'idb.scan_glossary_keys',
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

  // --- Glossary / IndexedDB Handlers ---
  // Load
  if (message.type === BG_MSG_TYPES.get_glossary) {
    getGlossaryFromDB(message.seriesId)
      .then(result => sendResponse(result)) // Returns object or { entries: [] }
      .catch(error => sendResponse({ _error: error.message }));
    return true;
  }

  // Save
  if (message.type === BG_MSG_TYPES.save_glossary) {
    saveGlossaryToDB(message.seriesId, message.glossary)
      .then(() => sendResponse({ _success: true }))
      .catch(error => sendResponse({ _error: error.message }));
    return true;
  }

  // Delete
  if (message.type === BG_MSG_TYPES.delete_glossary) {
    deleteGlossaryFromDB(message.seriesId)
      .then(() => sendResponse({ ok: true }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Scan Keys
  if (message.type === BG_MSG_TYPES.scan_glossary_keys) {
    scanAllKeysFromDB()
      .then(keys => sendResponse({ ok: true, data: keys }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  // Unknown message type
  console.warn('[Background] Unknown message type:', message.type);
  return false;
});

console.log('[Background] Service worker started');

self.addEventListener('beforeunload', () => {
  console.log('[Background] Service worker terminating...');
});
