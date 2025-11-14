/**
 * Manages dynamic model lists from providers.
 *
 * Responsibilities:
 * - Cache model lists in chrome.storage.local
 * - Refresh models from provider APIs
 * - Provide unified model list for UI
 *
 * Storage format: model_cache_${provider} -> Array<ModelInfo>
 * ModelInfo: { provider, id, model, label }
 */
export class ModelRegistry {
  constructor() {
    // In-memory cache: Map<provider, Array<ModelInfo>>
    this.cache = new Map();

    // Provider instances for fetching models
    this.providerInstances = null; // Set by ConfigManager
  }

  /**
   * Loads cached models from chrome.storage.
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Array<Object>|null>} Cached models or null if not found
   */
  async loadFromCache(provider) {
    if (this.cache.has(provider)) {
      return this.cache.get(provider);
    }

    const key = `model_cache_${provider}`;
    const result = await chrome.storage.local.get(key);
    const cached = result[key];

    if (cached && Array.isArray(cached)) {
      this.cache.set(provider, cached);
      console.log(`[ModelRegistry] Loaded ${cached.length} models for ${provider} from cache`);
      return cached;
    }

    return null;
  }

  /**
   * Saves models to chrome.storage and in-memory cache.
   *
   * @param {string} provider - Provider name
   * @param {Array<Object>} models - Array of model objects
   */
  async saveToCache(provider, models) {
    const key = `model_cache_${provider}`;
    await chrome.storage.local.set({ [key]: models });
    this.cache.set(provider, models);
    console.log(`[ModelRegistry] Cached ${models.length} models for ${provider}`);
  }

  /**
   * Refreshes model list from provider API.
   * Falls back to cache if fetch fails.
   *
   * @param {string} provider - Provider name
   * @returns {Promise<Array<Object>>} Updated model list
   */
  async refreshModels(provider) {
    console.log(`[ModelRegistry] Refreshing models for ${provider}`);

    try {
      // Get provider instance
      const providerInstance = this.providerInstances?.get(provider);
      if (!providerInstance) {
        throw new Error(`Provider instance not found: ${provider}`);
      }

      // Check if provider supports dynamic model fetching
      if (typeof providerInstance.getAvailableModels !== 'function') {
        console.log(`[ModelRegistry] Provider ${provider} does not support dynamic model fetching`);
        return [];
      }

      // Fetch models from provider
      const models = await providerInstance.getAvailableModels();

      // Save to cache
      await this.saveToCache(provider, models);

      return models;

    } catch (error) {
      console.error(`[ModelRegistry] Failed to refresh models for ${provider}:`, error.message);

      // Fallback to cached models
      const cached = await this.loadFromCache(provider);
      if (cached) {
        console.log(`[ModelRegistry] Using cached models for ${provider} (fetch failed)`);
        return cached;
      }

      throw error;
    }
  }

  /**
   * Gets all models for a provider (from cache or refresh).
   *
   * @param {string} provider - Provider name
   * @param {boolean} forceRefresh - Force refresh from API
   * @returns {Promise<Array<Object>>} Model list
   */
  async getModels(provider, forceRefresh = false) {
    if (forceRefresh) {
      return await this.refreshModels(provider);
    }

    // Try cache first
    const cached = await this.loadFromCache(provider);
    if (cached) {
      return cached;
    }

    // No cache - try refresh
    return await this.refreshModels(provider);
  }

  /**
   * Gets all models from all providers.
   *
   * @param {Array<string>} providers - List of provider names
   * @returns {Promise<Array<Object>>} Combined model list
   */
  async getAllModels(providers) {
    const allModels = [];

    for (const provider of providers) {
      try {
        const models = await this.getModels(provider, false);
        allModels.push(...models);
      } catch (error) {
        console.warn(`[ModelRegistry] Failed to get models for ${provider}:`, error.message);
        // Continue with other providers
      }
    }

    return allModels;
  }

  /**
   * Clears cache for a provider.
   *
   * @param {string} provider - Provider name
   */
  async clearCache(provider) {
    const key = `model_cache_${provider}`;
    await chrome.storage.local.remove(key);
    this.cache.delete(provider);
    console.log(`[ModelRegistry] Cleared cache for ${provider}`);
  }

  /**
   * Clears all model caches.
   */
  async clearAllCaches() {
    // Get all keys from storage
    const allKeys = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(allKeys).filter(key => key.startsWith('model_cache_'));

    // Remove all cache keys
    await chrome.storage.local.remove(cacheKeys);
    this.cache.clear();

    console.log(`[ModelRegistry] Cleared all model caches (${cacheKeys.length} providers)`);
  }
}