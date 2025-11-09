// popup/popup.js

const translateBtn = document.getElementById('translateBtn');
const statusEl = document.getElementById('status');

translateBtn.addEventListener('click', onTranslateClick);

function setStatus(text) {
  statusEl.textContent = text;
}

async function onTranslateClick() {
  translateBtn.disabled = true;
  setStatus('Starting pipeline in this tab...');

  try {
    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    // Fire-and-forget: we don’t await pipeline completion.
    // The content script handles the long-running work.
    await sendMessageToTab(tab.id, { type: 'pipeline.start', payload: { source: 'popup' } }, { awaitResponse: false });

    setStatus('Pipeline started. You can watch progress on the page.');
  } catch (err) {
    console.error('[Popup] Failed to start pipeline:', err);
    setStatus(`Error: ${err.message || String(err)}`);
  } finally {
    // Re-enable so the user can press again if desired
    translateBtn.disabled = false;
  }
}

// Utils

function getActiveTab() {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(tabs && tabs[0]);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Sends a message to a specific tab.
 * By default we send and do not wait for a response (popup should not hang).
 * Set opts.awaitResponse = true if you want to await the content script’s reply.
 */
function sendMessageToTab(tabId, message, opts = { awaitResponse: false }) {
  return new Promise((resolve, reject) => {
    try {
      if (opts.awaitResponse) {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(response);
        });
      } else {
        // Fire-and-forget: provide a no-op callback to surface lastError if it occurs immediately
        chrome.tabs.sendMessage(tabId, message, () => {
          const err = chrome.runtime.lastError;
          if (err) return reject(err);
          resolve(undefined);
        });
      }
    } catch (e) {
      reject(e);
    }
  });
}