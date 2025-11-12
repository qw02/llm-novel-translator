// src/background/utils/api-key-manager.js

/**
 * Retrieves the API key for a given provider from chrome.storage.local.
 *
 * Storage format:
 * {
 *   api_keys: {
 *     openai: 'sk-...',
 *     anthropic: 'sk-ant-...',
 *     google: '...',
 *     ...
 *   }
 * }
 *
 * @param {string} provider - The provider name (e.g., 'openai', 'anthropic')
 * @returns {Promise<string>} The API key
 * @throws {Error} If the API key is not found
 */
export async function getApiKey(provider) {
  const result = await chrome.storage.local.get('api_keys');
  const keys = result.api_keys || {};
  const key = keys[provider];

  if (!key) {
    throw new Error(`API key not found for provider: ${provider}`);
  }

  return key;
}

/**
 * Saves API keys to chrome.storage.local.
 *
 * @param {Object} keys - Object mapping provider names to API keys
 * @returns {Promise<void>}
 */
export async function saveApiKeys(keys) {
  await chrome.storage.local.set({ api_keys: keys });
}

/**
 * Retrieves all stored API keys.
 *
 * @returns {Promise<Object>} Object mapping provider names to API keys
 */
export async function getAllApiKeys() {
  const result = await chrome.storage.local.get('api_keys');
  return result.api_keys || {};
}