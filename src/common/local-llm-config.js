/**
 * Shared helpers for the local LLM (OpenAI-compatible) feature.
 *
 * Used by both the options page (load/save/validate) and the background
 * worker (request dispatch). Config lives in chrome.storage.local under
 * the `local_llm_config` key:
 *
 * {
 *   enabled: false,
 *   endpoint: 'http://localhost:8080/v1',
 *   extraParams: ''   // raw text; must JSON.parse to a plain object
 * }
 */

export const LOCAL_LLM_STORAGE_KEY = 'local_llm_config';

/**
 * Preset endpoints for popular local inference engines.
 * `custom` leaves the endpoint field untouched for free-form entry.
 */
export const LOCAL_LLM_PRESETS = [
  { key: 'llamacpp', label: 'llama.cpp (localhost:8080)', endpoint: 'http://localhost:8080/v1' },
  { key: 'ollama', label: 'Ollama (localhost:11434)', endpoint: 'http://localhost:11434/v1' },
  { key: 'koboldcpp', label: 'KoboldCpp (localhost:5001)', endpoint: 'http://localhost:5001/v1' },
  { key: 'custom', label: 'Custom…', endpoint: '' },
];

export const DEFAULT_LOCAL_LLM_CONFIG = {
  enabled: false,
  endpoint: LOCAL_LLM_PRESETS[0].endpoint,
  extraParams: '',
};

/**
 * Reads the local LLM config from storage, falling back to defaults.
 *
 * @returns {Promise<{enabled: boolean, endpoint: string, extraParams: string}>}
 */
export async function getLocalLlmConfig() {
  const result = await chrome.storage.local.get(LOCAL_LLM_STORAGE_KEY);
  const stored = result[LOCAL_LLM_STORAGE_KEY];

  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_LOCAL_LLM_CONFIG };
  }

  return {
    enabled: stored.enabled === true,
    endpoint: typeof stored.endpoint === 'string' ? stored.endpoint : DEFAULT_LOCAL_LLM_CONFIG.endpoint,
    extraParams: typeof stored.extraParams === 'string' ? stored.extraParams : '',
  };
}

/**
 * Saves the local LLM config to storage.
 *
 * @param {{enabled: boolean, endpoint: string, extraParams: string}} config
 * @returns {Promise<void>}
 */
export async function saveLocalLlmConfig(config) {
  await chrome.storage.local.set({
    [LOCAL_LLM_STORAGE_KEY]: {
      enabled: config.enabled === true,
      endpoint: config.endpoint || '',
      extraParams: config.extraParams || '',
    },
  });
}

/**
 * Parses the extra-params text into an object to be merged into the
 * OpenAI chat completion payload.
 *
 * @param {string} text - Raw textarea content
 * @returns {Object} Parsed params ({} for blank input)
 * @throws {Error} If the text is not valid JSON or not a plain object
 */
export function parseExtraParams(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return {};

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Extra params is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Extra params must be a single JSON object.');
  }

  return parsed;
}
