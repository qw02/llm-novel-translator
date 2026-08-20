import {
  LOCAL_LLM_PRESETS,
  DEFAULT_LOCAL_LLM_CONFIG,
  getLocalLlmConfig,
  saveLocalLlmConfig,
  parseExtraParams,
} from '../../../common/local-llm-config.js';
import {
  hasProviderHostPermissions,
  requestProviderHostPermissions,
} from '../../../common/provider-permissions.js';

const API_KEY_PROVIDERS = [
  'openrouter',
  'openai',
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

    // Local LLM (OpenAI-compatible) settings
    this.localEnabledCheckbox = null;
    this.localSettingsContainer = null;
    this.localPresetSelect = null;
    this.localEndpointInput = null;
    this.localExtraParamsInput = null;

    this.isInitialized = false;
    this.isDirty = false;
    this.originalKeys = {};
    this.originalLocalConfig = { ...DEFAULT_LOCAL_LLM_CONFIG };
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

    // Local LLM section
    this.localEnabledCheckbox = document.getElementById('local-llm-enabled');
    this.localSettingsContainer = document.getElementById('local-llm-settings');
    this.localPresetSelect = document.getElementById('local-llm-preset');
    this.localEndpointInput = document.getElementById('local-llm-endpoint');
    this.localExtraParamsInput = document.getElementById('local-llm-extra-params');

    LOCAL_LLM_PRESETS.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = preset.key;
      opt.textContent = preset.label;
      this.localPresetSelect.appendChild(opt);
    });
  }

  attachListeners() {
    Object.values(this.inputs).forEach((input) => {
      if (!input) return;
      input.addEventListener('input', () => {
        this.markDirty();
      });
    });

    // Local LLM inputs
    this.localEnabledCheckbox.addEventListener('change', async () => {
      // Enabling requires the optional localhost host permissions; the
      // request must originate from this user gesture.
      if (this.localEnabledCheckbox.checked) {
        const granted = await requestProviderHostPermissions('local');
        if (!granted) {
          this.localEnabledCheckbox.checked = false;
          this.setStatus('Local LLM requires permission to access localhost. Permission was not granted.', 'error');
        }
      }
      this.updateLocalSettingsVisibility();
      this.markDirty();
    });

    this.localPresetSelect.addEventListener('change', () => {
      const preset = LOCAL_LLM_PRESETS.find(p => p.key === this.localPresetSelect.value);
      if (preset && preset.endpoint) {
        this.localEndpointInput.value = preset.endpoint;
      }
      this.markDirty();
    });

    this.localEndpointInput.addEventListener('input', () => {
      this.markDirty();
    });

    this.localExtraParamsInput.addEventListener('input', () => {
      this.markDirty();
    });

    this.saveButton.addEventListener('click', async () => {
      await this.save();
    });

    this.cancelButton.addEventListener('click', () => {
      this.reset();
    });
  }

  updateLocalSettingsVisibility() {
    this.localSettingsContainer.hidden = !this.localEnabledCheckbox.checked;
  }

  /**
   * Picks the preset matching the given endpoint, falling back to 'custom'.
   *
   * @param {string} endpoint
   * @returns {string} Preset key
   */
  matchPreset(endpoint) {
    const preset = LOCAL_LLM_PRESETS.find(p => p.key !== 'custom' && p.endpoint === endpoint);
    return preset ? preset.key : 'custom';
  }

  applyLocalConfigToUI(config) {
    this.localEnabledCheckbox.checked = !!config.enabled;
    this.localEndpointInput.value = config.endpoint || '';
    this.localExtraParamsInput.value = config.extraParams || '';
    this.localPresetSelect.value = this.matchPreset(config.endpoint || '');
    this.updateLocalSettingsVisibility();
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

      const localConfig = await getLocalLlmConfig();
      this.originalLocalConfig = { ...localConfig };
      this.applyLocalConfigToUI(localConfig);

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

    // Validate local LLM settings before saving anything
    const localConfig = {
      enabled: this.localEnabledCheckbox.checked,
      endpoint: this.localEndpointInput.value.trim(),
      extraParams: this.localExtraParamsInput.value,
    };

    if (localConfig.enabled) {
      if (!localConfig.endpoint) {
        this.setStatus('Local LLM endpoint must be set when local LLM is enabled.', 'error');
        return;
      }

      // Permission gate: enabled implies the localhost host permissions were
      // granted (they may have been revoked since via Chrome settings)
      if (!(await hasProviderHostPermissions('local'))) {
        this.setStatus('Local LLM requires permission to access localhost. Untick and re-tick the checkbox to grant it.', 'error');
        return;
      }

      try {
        parseExtraParams(localConfig.extraParams);
      } catch (error) {
        this.setStatus(`Local LLM extra params: ${error.message}`, 'error');
        return;
      }
    }

    try {
      await setApiKeys(updated);
      await saveLocalLlmConfig(localConfig);
      this.originalKeys = { ...updated };
      this.originalLocalConfig = { ...localConfig };
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

    this.applyLocalConfigToUI(this.originalLocalConfig);

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
