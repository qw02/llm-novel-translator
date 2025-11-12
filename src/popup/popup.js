// Existing elements
const translateBtn = document.getElementById('translateBtn');
const getProgressBtn = document.getElementById('getProgressBtn');
const statusEl = document.getElementById('status');
const statusDiv = document.getElementById("status");
const simpleSection = document.getElementById("simpleSection");
const rawSection = document.getElementById("rawSection");
const simpleFormatDiv = document.getElementById("simpleFormat");
const rawJsonDiv = document.getElementById("rawJson");

// New API key elements
const openrouterKeyInput = document.getElementById('openrouterKey');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');

// Existing event listeners
translateBtn.addEventListener('click', onTranslateClick);
getProgressBtn.addEventListener('click', onProgressClick);

// New API key event listener
saveApiKeyBtn.addEventListener('click', onSaveApiKey);

// Load existing API key on popup load
loadApiKey();

async function loadApiKey() {
  try {
    const result = await chrome.storage.local.get('api_keys');
    if (result.api_keys?.openrouter) {
      openrouterKeyInput.value = result.api_keys.openrouter;
    }
  } catch (error) {
    console.error('[Popup] Failed to load API key:', error);
  }
}

async function onSaveApiKey() {
  const apiKey = openrouterKeyInput.value.trim();

  if (!apiKey) {
    showApiKeyStatus('Please enter an API key', 'error');
    return;
  }

  try {
    // Get existing keys
    const result = await chrome.storage.local.get('api_keys');
    const existingKeys = result.api_keys || {};

    // Update OpenRouter key
    existingKeys.openrouter = apiKey;

    // Save back to storage
    await chrome.storage.local.set({ api_keys: existingKeys });

    showApiKeyStatus('API key saved successfully!', 'success');
  } catch (error) {
    console.error('[Popup] Failed to save API key:', error);
    showApiKeyStatus('Failed to save: ' + error.message, 'error');
  }
}

function showApiKeyStatus(message, type) {
  apiKeyStatus.textContent = message;
  apiKeyStatus.className = type;
  apiKeyStatus.style.display = 'block';

  setTimeout(() => {
    apiKeyStatus.style.display = 'none';
  }, 3000);
}

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

    // Fire-and-forget: we don't await pipeline completion.
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

async function onProgressClick() {
  try {
    statusDiv.textContent = "Fetching progress...";

    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      statusDiv.textContent = "Error: No active tab found";
      return;
    }

    // Send message to the content script in that tab
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "getProgressState"
    });

    if (response?.success) {
      statusDiv.textContent = "Progress data retrieved!";
      displayProgressData(response.data);
    } else {
      statusDiv.textContent = "Error: Invalid response from content script";
    }
  } catch (error) {
    statusDiv.textContent = `Error: ${error.message}`;
    console.error("Failed to get progress:", error);
  }
}

function displayProgressData(data) {
  // Show both sections
  simpleSection.style.display = "block";
  rawSection.style.display = "block";

  // Display raw JSON
  rawJsonDiv.textContent = JSON.stringify(data, null, 2);

  // Display simple formatted version
  let html = "";

  // Global progress
  if (data.global) {
    html += `<strong>Global Progress:</strong><br>`;
    html += `Progress: ${(data.global.progress * 100).toFixed(1)}%<br>`;
    html += `Total: ${data.global.total} | Completed: ${data.global.completed} | Remaining: ${data.global.remaining}<br>`;
    html += `Errors: ${data.global.errors}<br>`;
    html += `<br>`;
  }

  // Individual stages
  html += `<strong>Stages:</strong><br>`;
  for (const [stageId, stage] of Object.entries(data)) {
    if (stageId === "global") continue;

    html += `<br><strong>${stage.label || stageId}</strong><br>`;
    html += `Status: ${stage.done ? "✓ Done" : "In Progress"}<br>`;
    html += `Completed: ${stage.completed}/${stage.total}`;

    if (!stage.done) {
      html += ` (${(stage.progress * 100).toFixed(1)}%)<br>`;
      html += `Speed: ${stage.speed} tasks/sec | ETA: ${stage.eta}s<br>`;
      html += `Elapsed: ${stage.elapsed}s<br>`;
    } else {
      html += `<br>`;
    }

    if (stage.errorCount > 0) {
      html += `<span style="color: #d00;">Errors: ${stage.errorCount}</span><br>`;
    }
  }

  simpleFormatDiv.innerHTML = html;
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
 * Set opts.awaitResponse = true if you want to await the content script's reply.
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