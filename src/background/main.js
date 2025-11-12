/**
 * Background service worker entry point.
 * Minimal message router that delegates to appropriate handlers.
 */
import { LLMCoordinator } from "./llm-coordinator.js";

const BG_MSG_TYPES = {
  llm_request: 'llm_request',
  llm_cancel: 'llm_cancel',
};

// Initialize coordinator for LLM external calls
const coordinator = new LLMCoordinator();

/**
 * Message handler for chrome.runtime.sendMessage from content scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // LLM completion request
  if (message.type === BG_MSG_TYPES.llm_request) {
    coordinator.handleRequest(message.payload, sendResponse);
    return true; // Keep channel open for async response
  }

  // LLM cancellation request
  if (message.type === BG_MSG_TYPES.llm_cancel) {
    coordinator.handleCancel(message.payload);
    return false; // No response needed
  }

  // Unknown message type
  console.warn('[Background] Unknown message type:', message.type);
  return false;
});

console.log('[Background] Service worker started');

self.addEventListener('beforeunload', () => {
  console.log('[Background] Service worker terminating...');
});