import { PROVIDER_CONFIGS, DEFAULT_PARAMS } from './defaults.js';
import { getApiKey, getAllApiKeys } from '../utils/api-key-manager.js';

/**
 * Manages configuration from multiple sources and model list caching.
 *
 * Config resolution precedence:
 * 1. customParams (from content script per-request)
 * 2. userParams (from options page, stored in chrome.storage)
 * 3. hardcoded defaults (from PROVIDER_CONFIGS), if exist for selected model
 * 4. provider defaults (fallback)
 *
 * Model list management:
 * - Hardcoded recommended models (always available)
 * - Cached models from provider APIs (when showAll is enabled)
 * - Simple cache: exists or doesn't
 */
export class ConfigManager {
  constructor() {
    this.hardcodedConfigs = PROVIDER_CONFIGS;

    // In-memory cache for user parameters
    this.userParams = null;

    // In-memory cache for model lists: Map<provider, models[]>
    this.modelCache = new Map();

    console.log('[ConfigManager] Initialized');
  }

  /**
   * Resolves llmId to full configuration with merged parameters.
   *
   * @param {string} llmId - Model identifier (e.g., '1-1', 'custom-gpt-4')
   * @param {Object} customParams - Custom parameters from content script
   * @returns {Promise<Object>} Resolved config: { providerType, endpoint, params }
   */
  async resolveConfig(llmId, customParams = {}) {
    // Step 1: Find the model config (search all sources)
    const modelConfig = await this._findModelConfig(llmId);

    if (!modelConfig) {
      throw new Error(`Model not found: ${llmId}`);
    }

    // Step 2: Load user parameters if not already loaded
    if (this.userParams === null) {
      await this._loadUserParams();
    }

    // Step 3: Get provider config for endpoint
    const providerConfig = this.hardcodedConfigs[modelConfig.provider];
    if (!providerConfig) {
      throw new Error(`Provider config not found: ${modelConfig.provider}`);
    }

    // Step 4: Merge parameters with precedence
    const params = this._mergeParams(modelConfig, customParams);

    return {
      providerType: modelConfig.provider,
      endpoint: modelConfig.endpoint || providerConfig.endpoint,
      params,
    };
  }

  /**
   * Gets model list based on mode.
   *
   * @param {Object} options
   * @param {boolean} options.showAll - If true, include cached models from providers
   * @returns {Promise<Array>} Array of model configs
   */
  async getModelList({ showAll = false }) {
    const models = [];

    // Always include hardcoded recommended models
    for (const [provider, config] of Object.entries(this.hardcodedConfigs)) {
      config.models.forEach(model => {
        models.push({
          provider,
          id: model.id,
          model: model.model,
          label: model.label,
          source: 'recommended',
        });
      });
    }

    // If showAll is enabled, add cached models from providers
    if (showAll) {
      const apiKeys = await getAllApiKeys();

      for (const provider of Object.keys(apiKeys)) {
        // Load cached models for this provider
        const cached = await this._loadModelCache(provider);

        if (cached && cached.length > 0) {
          cached.forEach(model => {
            // Avoid duplicates (check if id already exists)
            if (!models.find(m => m.id === model.id)) {
              models.push({
                ...model,
                source: 'provider',
              });
            }
          });
        }
      }
    }

    console.log(`[ConfigManager] Returning ${models.length} models (showAll: ${showAll})`);
    return models;
  }

  /**
   * Refreshes model lists from all providers with API keys.
   * Fetches from provider APIs and caches results.
   *
   * @param {Object} providerRegistry - Map of provider classes for calling getAvailableModels()
   * @returns {Promise<Object>} Summary of refresh results
   */
  async refreshModelList(providerRegistry) {
    const apiKeys = await getAllApiKeys();
    const results = {
      success: [],
      failed: [],
      skipped: [],
    };

    console.log('[ConfigManager] Refreshing model lists for providers:', Object.keys(apiKeys));

    for (const [provider, apiKey] of Object.entries(apiKeys)) {
      try {
        const ProviderClass = providerRegistry[provider];

        if (!ProviderClass) {
          console.warn(`[ConfigManager] No provider class found for: ${provider}`);
          results.skipped.push(provider);
          continue;
        }

        // Get endpoint from config
        const providerConfig = this.hardcodedConfigs[provider];
        const endpoint = providerConfig?.endpoint;

        if (!endpoint) {
          console.warn(`[ConfigManager] No endpoint configured for: ${provider}`);
          results.skipped.push(provider);
          continue;
        }

        // Create temporary provider instance to fetch models
        const providerInstance = new ProviderClass({ endpoint, apiKey });

        // Check if provider implements getAvailableModels
        if (typeof providerInstance.getAvailableModels !== 'function') {
          console.log(`[ConfigManager] Provider ${provider} does not implement getAvailableModels`);
          results.skipped.push(provider);
          continue;
        }

        // Fetch models from provider
        console.log(`[ConfigManager] Fetching models from ${provider}...`);
        const models = await providerInstance.getAvailableModels();

        // Save to cache
        await this._saveModelCache(provider, models);

        // Update in-memory cache
        this.modelCache.set(provider, models);

        results.success.push({ provider, count: models.length });
        console.log(`[ConfigManager] Cached ${models.length} models from ${provider}`);

      } catch (error) {
        console.error(`[ConfigManager] Failed to refresh models for ${provider}:`, error.message);
        results.failed.push({ provider, error: error.message });
      }
    }

    console.log('[ConfigManager] Refresh complete:', results);
    return results;
  }

  /**
   * Clears all cached model lists.
   *
   * @returns {Promise<void>}
   */
  async clearModelCache() {
    console.log('[ConfigManager] Clearing model cache...');

    // Get all providers that have cached models
    const storage = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(storage).filter(key => key.startsWith('model_cache_'));

    if (cacheKeys.length > 0) {
      await chrome.storage.local.remove(cacheKeys);
      console.log(`[ConfigManager] Removed ${cacheKeys.length} cached model lists`);
    }

    // Clear in-memory cache
    this.modelCache.clear();
  }

  /**
   * Gets available providers (those with API keys configured).
   *
   * @returns {Promise<Array<string>>} Array of provider names
   */
  async getAvailableProviders() {
    const apiKeys = await getAllApiKeys();
    return Object.keys(apiKeys);
  }

  /**
   * Finds model config by llmId across all sources.
   *
   * @param {string} llmId - Model identifier
   * @returns {Promise<Object|null>} Model config or null if not found
   * @private
   */
  async _findModelConfig(llmId) {
    // Search hardcoded configs first
    for (const [provider, config] of Object.entries(this.hardcodedConfigs)) {
      const model = config.models.find(m => m.id === llmId);
      if (model) {
        return {
          ...model,
          provider,
          endpoint: config.endpoint,
        };
      }
    }

    // Search cached models from providers
    const apiKeys = await getAllApiKeys();

    for (const provider of Object.keys(apiKeys)) {
      const cached = await this._loadModelCache(provider);

      if (cached) {
        const model = cached.find(m => m.id === llmId);
        if (model) {
          // Get endpoint from provider config
          const providerConfig = this.hardcodedConfigs[provider];
          return {
            ...model,
            provider,
            endpoint: model.endpoint || providerConfig?.endpoint,
          };
        }
      }
    }

    return null;
  }

  /**
   * Merges parameters from all sources with correct precedence.
   * Includes all keys from each source except metadata keys {id, model, label}.
   *
   * Precedence: customParams > userParams > modelConfig > defaults
   *
   * The provider's completion() method is responsible for:
   * - Using supported parameters
   * - Ignoring unsupported parameters
   * - Transforming parameters to provider-specific format
   *
   * @param {Object} modelConfig - Base model configuration
   * @param {Object} customParams - Custom parameters from content script
   * @returns {Object} Merged parameters
   * @private
   */
  _mergeParams(modelConfig, customParams) {
    // Start with base defaults
    const params = {
      model: modelConfig.model,
      temperature: DEFAULT_PARAMS.temperature,
      top_p: DEFAULT_PARAMS.top_p,
      max_tokens: DEFAULT_PARAMS.max_tokens,
    };

    const excludedKeys = new Set(['id', 'label', 'provider', 'endpoint', 'model', 'source']);

    // Apply ALL keys from model config (except metadata)
    for (const [key, value] of Object.entries(modelConfig)) {
      if (!excludedKeys.has(key)) {
        params[key] = value;
      }
    }

    // Apply ALL keys from user parameters (override model config)
    if (this.userParams) {
      for (const [key, value] of Object.entries(this.userParams)) {
        params[key] = value;
      }
    }

    // Apply ALL keys from custom parameters (highest priority)
    for (const [key, value] of Object.entries(customParams)) {
      params[key] = value;
    }

    return params;
  }
  /**
   * Loads user parameters from chrome.storage.
   *
   * @returns {Promise<void>}
   * @private
   */
  async _loadUserParams() {
    const result = await chrome.storage.local.get('userParams');
    this.userParams = result.userParams || {};
    console.log('[ConfigManager] Loaded user params:', this.userParams);
  }

  /**
   * Loads cached model list for a provider.
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Array|null>} Cached models or null
   * @private
   */
  async _loadModelCache(provider) {
    // Check in-memory cache first
    if (this.modelCache.has(provider)) {
      return this.modelCache.get(provider);
    }

    // Load from storage
    const key = `model_cache_${provider}`;
    const result = await chrome.storage.local.get(key);
    const cached = result[key] || null;

    if (cached) {
      this.modelCache.set(provider, cached);
      console.log(`[ConfigManager] Loaded ${cached.length} cached models for ${provider}`);
    }

    return cached;
  }

  /**
   * Saves model list to cache.
   *
   * @param {string} provider - Provider name
   * @param {Array} models - Array of model configs
   * @returns {Promise<void>}
   * @private
   */
  async _saveModelCache(provider, models) {
    const key = `model_cache_${provider}`;
    await chrome.storage.local.set({ [key]: models });
    console.log(`[ConfigManager] Saved ${models.length} models to cache for ${provider}`);
  }
}