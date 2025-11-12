export const MSG_TYPE = {
  llm_request: 'llm_request',
  llm_cancel: 'llm_cancel',
};

// Helper for content script
export async function sendMessageToBackend(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}