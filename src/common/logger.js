let loggingEnabled = true;

chrome.storage.local.get('loggingEnabled').then((result) => {
  loggingEnabled = result.loggingEnabled ?? true;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.loggingEnabled) {
    loggingEnabled = changes.loggingEnabled.newValue;
  }
});

export function log(...args) {
  if (loggingEnabled) {
    console.log('[LLM Novel Translator]\n', ...args);
  }
}
