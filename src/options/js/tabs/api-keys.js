const API_KEY_PROVIDERS = [
  'openrouter',
  'openai',
  'anthropic',
  'deepseek',
  'google',
  'xai'
];

async function getApiKeys() {
  const result = await chrome.storage.local.get('api_keys');
  const existing = result.api_keys || {};
  const keys = {};

  API_KEY_PROVIDERS.forEach((provider) => {
    keys[provider] = existing[provider] || '';
  });

  return keys;
}

async function setApiKeys(updatedKeys) {
  const result = await chrome.storage.local.get('api_keys');
  const existing = result.api_keys || {};

  // Remove providers managed by this page
  API_KEY_PROVIDERS.forEach((provider) => {
    if (provider in existing) {
      delete existing[provider];
    }
  });

  const merged = {
    ...existing,
    ...updatedKeys
  };

  await chrome.storage.local.set({ api_keys: merged });
}

class ApiKeysTabController {
  constructor() {
    this.tabId = 'api-keys';
    this.root = null;
    this.inputs = {};
    this.statusElement = null;
    this.saveButton = null;
    this.cancelButton = null;

    this.isInitialized = false;
    this.isDirty = false;
    this.originalKeys = {};
  }

  async onShow() {
    if (!this.isInitialized) {
      this.initDom();
      this.attachListeners();
      this.isInitialized = true;
    }
    await this.loadKeys();
  }

  initDom() {
    this.root = document.getElementById('tab-api-keys');
    this.statusElement = document.getElementById('api-keys-status');
    this.saveButton = document.getElementById('api-keys-save');
    this.cancelButton = document.getElementById('api-keys-cancel');

    API_KEY_PROVIDERS.forEach((provider) => {
      const input = this.root.querySelector(
        `input.api-key-input[data-provider="${provider}"]`
      );
      this.inputs[provider] = input;
    });
  }

  attachListeners() {
    Object.values(this.inputs).forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        this.markDirty();
      });
    });

    this.saveButton.addEventListener('click', async () => {
      await this.save();
    });

    this.cancelButton.addEventListener('click', () => {
      this.reset();
    });
  }

  async loadKeys() {
    try {
      const keys = await getApiKeys();
      this.originalKeys = { ...keys };

      API_KEY_PROVIDERS.forEach((provider) => {
        const input = this.inputs[provider];
        if (!input) return;
        input.value = keys[provider] || '';
      });

      this.isDirty = false;
      this.setStatus('', '');
    } catch (error) {
      console.error('[Options] Failed to load API keys:', error);
      this.setStatus('Failed to load API keys.', 'error');
    }
  }

  markDirty() {
    this.isDirty = true;
  }

  async save() {
    const updated = {};

    API_KEY_PROVIDERS.forEach((provider) => {
      const input = this.inputs[provider];
      if (!input) return;
      const value = input.value.trim();
      if (value) {
        updated[provider] = value;
      }
    });

    try {
      await setApiKeys(updated);
      this.originalKeys = { ...updated };
      this.isDirty = false;
      this.setStatus('API keys saved.', 'success');
    } catch (error) {
      console.error('[Options] Failed to save API keys:', error);
      this.setStatus('Failed to save API keys.', 'error');
      throw error;
    }
  }

  reset() {
    API_KEY_PROVIDERS.forEach((provider) => {
      const input = this.inputs[provider];
      if (!input) return;
      input.value = this.originalKeys[provider] || '';
    });

    this.isDirty = false;
    this.setStatus('Changes discarded.', 'info');
  }

  canNavigateAway() {
    return !this.isDirty;
  }

  setStatus(message, type) {
    if (!this.statusElement) return;
    this.statusElement.textContent = message || '';
    this.statusElement.dataset.statusType = type || '';
  }
}

export const apiKeysTabController = new ApiKeysTabController();