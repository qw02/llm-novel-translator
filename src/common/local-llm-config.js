/**
 * Shared helpers for the local LLM (OpenAI-compatible) feature.
 *
 * Used by both the options page (load/save/validate) and the background
 * worker (request dispatch). Config lives in chrome.storage.local under
 * the `local_llm_config` key:
 *
 * {
 *   enabled: false,
 *   port: 8080,             // local port; host is fixed to 127.0.0.1
 *   extraParams: ''         // raw text; must JSON.parse to a plain object
 * }
 *
 * The endpoint is always `http://127.0.0.1:<port>/v1` (OpenAI-style chat
 * completions). The host and path are fixed to keep the required optional
 * host permission scoped to `http://127.0.0.1/*`; only the port is free-form.
 */

export const LOCAL_LLM_STORAGE_KEY = 'local_llm_config';

export const LOCAL_LLM_HOST = 'http://127.0.0.1';
export const LOCAL_LLM_PATH = '/v1';
export const LOCAL_LLM_DEFAULT_PORT = 8080;
export const LOCAL_LLM_PORT_MIN = 1;
export const LOCAL_LLM_PORT_MAX = 65535;

/**
 * Presets for popular local inference engines. Selecting one fills in the
 * port; the port remains editable.
 */
export const LOCAL_LLM_PRESETS = [
  { key: 'llamacpp', label: 'llama.cpp', port: 8080 },
  { key: 'ollama', label: 'Ollama', port: 11434 },
  { key: 'koboldcpp', label: 'KoboldCpp', port: 5001 },
];

export const DEFAULT_LOCAL_LLM_CONFIG = {
  enabled: false,
  port: LOCAL_LLM_DEFAULT_PORT,
  extraParams: '',
};

/**
 * Normalizes an arbitrary value to a valid port number.
 * Falls back to `fallback` for non-numeric / out-of-range input.
 *
 * @param {*} value - Raw value (string or number)
 * @param {number} [fallback=LOCAL_LLM_DEFAULT_PORT]
 * @returns {number} Valid port
 */
export function normalizePort(value, fallback = LOCAL_LLM_DEFAULT_PORT) {
  const port = parseInt(value, 10);
  if (Number.isNaN(port)) return fallback;
  return Math.min(LOCAL_LLM_PORT_MAX, Math.max(LOCAL_LLM_PORT_MIN, port));
}

/**
 * Builds the base OpenAI endpoint URL for a port.
 *
 * @param {number|string} port
 * @returns {string} e.g. 'http://127.0.0.1:8080/v1'
 */
export function buildLocalEndpoint(port) {
  return `${LOCAL_LLM_HOST}:${normalizePort(port)}${LOCAL_LLM_PATH}`;
}

/**
 * Reads the local LLM config from storage, falling back to defaults.
 *
 * @returns {Promise<{enabled: boolean, port: number, extraParams: string}>}
 */
export async function getLocalLlmConfig() {
  const result = await chrome.storage.local.get(LOCAL_LLM_STORAGE_KEY);
  const stored = result[LOCAL_LLM_STORAGE_KEY];

  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_LOCAL_LLM_CONFIG };
  }

  return {
    enabled: stored.enabled === true,
    port: normalizePort((stored.port ?? stored.endpoint) || LOCAL_LLM_DEFAULT_PORT),
    extraParams: typeof stored.extraParams === 'string' ? stored.extraParams : '',
  };
}

/**
 * Saves the local LLM config to storage.
 *
 * @param {{enabled: boolean, port: number|string, extraParams: string}} config
 * @returns {Promise<void>}
 */
export async function saveLocalLlmConfig(config) {
  await chrome.storage.local.set({
    [LOCAL_LLM_STORAGE_KEY]: {
      enabled: config.enabled === true,
      port: normalizePort(config.port, LOCAL_LLM_DEFAULT_PORT),
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
