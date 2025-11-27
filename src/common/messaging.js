export const MSG_TYPE = {
  llm_request: 'llm_request',
  llm_cancel: 'llm_cancel',
  get_glossary: 'idb.get_glossary',
  save_glossary: 'idb.save_glossary',
  delete_glossary: 'idb.delete_glossary',
  scan_glossary_keys: 'idb.scan_glossary_keys',
};

// Helper for content script
export async function sendMessageToBackend(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

export const POPUP_MSG_TYPE = {
  ping: 'popup_ping',
  get_progress_state: 'popup_get_progress_state',
  pipeline_getState: 'pipeline.getState',
  site_supported: 'site.supported',
  pipeline_start: 'pipeline.start',
  pipeline_continue: 'pipeline.continue',
  pipeline_cancel: 'pipeline.cancel',
  glossary_showWidget: 'glossary.showWidget',
  display_preview: 'preview.show'
};
