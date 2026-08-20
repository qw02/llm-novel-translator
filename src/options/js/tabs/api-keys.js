import {
  LOCAL_LLM_PRESETS,
  DEFAULT_LOCAL_LLM_CONFIG,
  getLocalLlmConfig,
  saveLocalLlmConfig,
  parseExtraParams,
  normalizePort,
  LOCAL_LLM_DEFAULT_PORT,
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
  'xai',
  'nanogpt'
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
    this.localPortInput = null;
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
    this.localPortInput = document.getElementById('local-llm-port');
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
      // Enabling requires the optional loopback host permission; the
      // request must originate from this user gesture.
      if (this.localEnabledCheckbox.checked) {
        const granted = await requestProviderHostPermissions('local');
        if (!granted) {
          this.localEnabledCheckbox.checked = false;
          this.setStatus('Local LLM requires permission to access 127.0.0.1. Permission was not granted.', 'error');
        }
      }
      this.updateLocalSettingsVisibility();
      this.markDirty();
    });

    this.localPresetSelect.addEventListener('change', () => {
      const preset = LOCAL_LLM_PRESETS.find(p => p.key === this.localPresetSelect.value);
      if (preset) {
        this.localPortInput.value = preset.port;
      }
      this.markDirty();
    });

    this.localPortInput.addEventListener('input', () => {
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
   * Picks the preset matching the given port, or the first preset if none match.
   *
   * @param {number} port - Currently configured port
   * @returns {string} Preset key
   */
  matchPreset(port) {
    const normalized = normalizePort(port, LOCAL_LLM_DEFAULT_PORT);
    const matching = LOCAL_LLM_PRESETS.find(p => p.port === normalized);
    return matching ? matching.key : LOCAL_LLM_PRESETS[0].key;
  }

  applyLocalConfigToUI(config) {
    this.localEnabledCheckbox.checked = !!config.enabled;
    this.localPortInput.value = normalizePort(config.port, LOCAL_LLM_DEFAULT_PORT);
    this.localExtraParamsInput.value = config.extraParams || '';
    this.localPresetSelect.value = this.matchPreset(config.port);
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

    // Validate local LLM settings before saving anything.
    // normalizePort coerces input into the valid 1-65535 range.
    const localConfig = {
      enabled: this.localEnabledCheckbox.checked,
      port: normalizePort(this.localPortInput.value),
      extraParams: this.localExtraParamsInput.value,
    };

    if (localConfig.enabled) {
      // Permission gate: enabled implies the 127.0.0.1 host permission was
      // granted (it may have been revoked since via Chrome settings)
      if (!(await hasProviderHostPermissions('local'))) {
        this.setStatus('Local LLM requires permission to access 127.0.0.1. Untick and re-tick the checkbox to grant it.', 'error');
        return;
      }

      try {
        parseExtraParams(localConfig.extraParams);
      } catch (error) {
        this.setStatus(`Local LLM extra params: ${error.message}`, 'error');
        return;
      }
    }

    // NanoGPT uses an optional host permission (https://nano-gpt.com). When a
    // key is present but the permission hasn't been granted yet, request it
    // from this save click. If the user declines, still persist the key but
    // show a warning; Save remains usable so another click can retry the grant.
    if (updated.nanogpt && !(await hasProviderHostPermissions('nanogpt'))) {
      const granted = await requestProviderHostPermissions('nanogpt');

      try {
        await this.persistApiKeysAndLocalConfig(updated, localConfig);
      } catch (error) {
        console.error('[Options] Failed to save API keys:', error);
        this.setStatus('Failed to save API keys.', 'error');
        throw error;
      }

      if (granted) {
        this.setStatus('API keys saved.', 'success');
      } else {
        this.setStatus(
          'NanoGPT API key saved, but permission to access nano-gpt.com was not granted. Click Save again to retry granting it.',
          'warning'
        );
      }
      return;
    }

    try {
      await this.persistApiKeysAndLocalConfig(updated, localConfig);
      this.setStatus('API keys saved.', 'success');
    } catch (error) {
      console.error('[Options] Failed to save API keys:', error);
      this.setStatus('Failed to save API keys.', 'error');
      throw error;
    }
  }

  /**
   * Persists API keys and the local LLM config together and marks the tab clean.
   *
   * @param {Object} updated - Non-empty API keys by provider
   * @param {Object} localConfig - Normalized local LLM config
   */
  async persistApiKeysAndLocalConfig(updated, localConfig) {
    await setApiKeys(updated);
    await saveLocalLlmConfig(localConfig);
    this.originalKeys = { ...updated };
    this.originalLocalConfig = { ...localConfig };
    this.isDirty = false;
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
