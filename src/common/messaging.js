export const MSG_TYPE = {
  TRANSLATE_REQUEST: 'TRANSLATE_REQUEST',
  TRANSLATION_RESULT: 'TRANSLATION_RESULT',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
};

// Helper for content script
export async function sendMessageToBackend(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}