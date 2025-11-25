import PQueue from 'p-queue';
import { PROVIDER_CONFIGS, PROVIDER_TYPE_MAP, RATE_LIMIT_CONFIG } from './config/defaults.js';
import { getApiKey } from './utils/api-key-manager.js';
import { OpenRouterProvider } from './providers/openrouter-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { DeepSeekProvider } from './providers/deepseek-provider.js';
import { GoogleProvider } from './providers/google-provider.js';
import { ConfigManager } from "./config/config-manager.js";
import { XaiProvider } from "./providers/xai-provider.js";

/**
 * Registry mapping provider types to their implementation classes.
 * Extended in Phase 3 with additional providers.
 */
const PROVIDER_REGISTRY = {
  openrouter: OpenRouterProvider,
  openai: OpenAIProvider,
  deepseek: DeepSeekProvider,
  google: GoogleProvider,
  xai: XaiProvider,
};

/**
 * Coordinates LLM requests across multiple providers.
 *
 * Responsibilities:
 * - Lazy provider instantiation and lifecycle management
 * - Per-provider rate limiting via p-queue
 * - Request tracking for cancellation
 */
export class LLMCoordinator {
  constructor() {
    // Provider instances: Map<providerType, ProviderInstance>
    this.providers = new Map();

    // Per-provider queues: Map<providerType, PQueue>
    this.queues = new Map();

    // Active requests for cancellation: Map<clientId, Set<requestId>>
    this.activeRequests = new Map();

    // Request ID counter
    this.nextRequestId = 1;

    // Config manager for multi-source resolution
    this.configManager = new ConfigManager();
  }

  /**
   * Handles an LLM completion request from content script.
   *
   * @param {Object} payload - Request payload from content script
   * @param {string} payload.clientId - Unique client identifier
   * @param {string} payload.llmId - Model identifier (e.g., '1-1', '3-4')
   * @param {string} payload.systemPrompt - System instruction
   * @param {string} payload.userMessage - User message
   * @param {Object} [payload.customParams] - Custom parameters to override defaults
   * @param {Function} sendResponse - Chrome message response callback
   */
  async handleRequest(payload, sendResponse) {
    const { clientId, llmId, systemPrompt, userMessage, customParams = {} } = payload;
    const requestId = this.nextRequestId++;

    console.log(`[LLMCoordinator] Request ${requestId} from client ${clientId}:`, {
      llmId,
      customParams,
    });

    // Track this request for potential cancellation
    this._trackRequest(clientId, requestId);

    try {
      // Step 1: Resolve configuration via ConfigManager
      const config = await this.configManager.resolveConfig(llmId, customParams);

      // Step 2: Get or create provider instance
      const provider = await this._getProvider(config.providerType, config.endpoint);

      // Step 3: Get queue for this provider type
      const queue = this._getQueue(config.providerType);

      // Step 4: Build messages
      const messages = this._buildMessages(systemPrompt, userMessage);

      // Step 5: Queue the request
      const result = await queue.add(async () => {
        // Check if request was cancelled while in queue
        if (!this._isRequestActive(clientId, requestId)) {
          throw new Error('Request cancelled while in queue');
        }

        // Execute provider completion
        return await provider.completion(messages, config.params);
      });

      // Step 6: Return success response
      this._untrackRequest(clientId, requestId);

      sendResponse({
        ok: true,
        data: result,
      });

      console.log(`[LLMCoordinator] Request ${requestId} completed successfully`);

    } catch (error) {
      this._untrackRequest(clientId, requestId);

      console.error(`[LLMCoordinator] Request ${requestId} failed:`, error.message);

      sendResponse({
        ok: false,
        error: error.message || 'Unknown error occurred',
      });
    }
  }

  /**
   * Handles cancellation request from content script.
   *
   * @param {Object} payload - Cancellation payload
   * @param {string} payload.clientId - Client to cancel requests for
   * @param {number} payload.pendingCount - Number of pending requests (for logging)
   */
  handleCancel(payload) {
    const { clientId, pendingCount } = payload;

    // Simple cancellation: remove from tracking
    // In-flight requests will complete but content script will discard responses
    const cancelled = this.activeRequests.delete(clientId);
  }

  /**
   * Gets model list from ConfigManager.
   *
   * @param {Object} options
   * @param {boolean} options.showAll - Include cached provider models
   * @returns {Promise<Array>} Array of model configs
   */
  async getModelList(options) {
    return await this.configManager.getModelList(options);
  }

  /**
   * Refreshes model lists from all providers.
   *
   * @returns {Promise<Object>} Refresh results summary
   */
  async refreshModelList() {
    return await this.configManager.refreshModelList(PROVIDER_REGISTRY);
  }

  /**
   * Clears all cached model lists.
   *
   * @returns {Promise<void>}
   */
  async clearModelCache() {
    return await this.configManager.clearModelCache();
  }

  /**
   * Resolves llmId to full configuration.
   * Simplified for Phase 2 - only uses hardcoded configs.
   * Phase 4 will implement full ConfigManager with multi-source resolution.
   *
   * @param {string} llmId - Model identifier (e.g., '1-1', '3-4')
   * @param {Object} customParams - Custom parameters from content script
   * @returns {Promise<Object>} Resolved config with provider, endpoint, and merged params
   * @private
   */
  async _resolveConfig(llmId, customParams) {
    // Find the model in hardcoded configs
    let foundModel = null;
    let foundProvider = null;

    for (const [providerType, providerConfig] of Object.entries(PROVIDER_CONFIGS)) {
      const model = providerConfig.models.find(m => m.id === llmId);
      if (model) {
        foundModel = model;
        foundProvider = providerType;
        break;
      }
    }

    if (!foundModel || !foundProvider) {
      throw new Error(`Model not found: ${llmId}`);
    }

    const providerConfig = PROVIDER_CONFIGS[foundProvider];

    // Merge parameters with precedence: customParams > model config > defaults
    const params = {
      model: foundModel.model,
      temperature: customParams.temperature ?? foundModel.temperature ?? 0.6,
      max_tokens: customParams.max_tokens ?? foundModel.tokens ?? 4096,
    };

    // Add provider-specific parameters
    ["providers", "reasoning"].forEach(key => {
      if (foundModel[key] !== undefined) {
        params[key] = foundModel[key];
      }
    });

    return {
      providerType: foundProvider,
      endpoint: providerConfig.endpoint,
      params,
    };
  }

  /**
   * Gets or creates a provider instance.
   * Providers are created lazily on first request and kept alive.
   *
   * @param {string} providerType - Provider type (e.g., 'openrouter', 'openai')
   * @param {string} endpoint - API endpoint URL
   * @returns {Promise<BaseProvider>} Provider instance
   * @private
   */
  async _getProvider(providerType, endpoint) {
    const key = providerType;

    if (this.providers.has(key)) {
      return this.providers.get(key);
    }

    // Create new provider instance
    console.log(`[LLMCoordinator] Creating new provider: ${providerType}`);

    const ProviderClass = PROVIDER_REGISTRY[providerType];
    if (!ProviderClass) {
      throw new Error(`No provider implementation found for: ${providerType}`);
    }

    // Fetch API key
    const apiKey = await getApiKey(providerType);

    // Instantiate provider
    const provider = new ProviderClass({ endpoint, apiKey });
    this.providers.set(key, provider);

    console.log(`[LLMCoordinator] Provider ${providerType} initialized`);

    return provider;
  }

  /**
   * Gets or creates a queue for a provider type.
   * All providers use the same rate limit configuration.
   *
   * @param {string} providerType - Provider type
   * @returns {PQueue} Queue instance
   * @private
   */
  _getQueue(providerType) {
    if (this.queues.has(providerType)) {
      return this.queues.get(providerType);
    }

    console.log(`[LLMCoordinator] Creating queue for provider: ${providerType}`);

    const queue = new PQueue({
      concurrency: RATE_LIMIT_CONFIG.concurrency,
      intervalCap: RATE_LIMIT_CONFIG.intervalCap,
      interval: RATE_LIMIT_CONFIG.interval,
    });

    this.queues.set(providerType, queue);

    return queue;
  }

  /**
   * Builds messages array from system prompt and user message.
   *
   * @param {string} systemPrompt - System instruction
   * @param {string} userMessage - User message
   * @returns {Array<Object>} Messages array
   * @private
   */
  _buildMessages(systemPrompt, userMessage) {
    const messages = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  /**
   * Tracks a request for potential cancellation.
   *
   * @param {string} clientId - Client identifier
   * @param {number} requestId - Request identifier
   * @private
   */
  _trackRequest(clientId, requestId) {
    if (!this.activeRequests.has(clientId)) {
      this.activeRequests.set(clientId, new Set());
    }
    this.activeRequests.get(clientId).add(requestId);
  }

  /**
   * Removes a request from tracking.
   *
   * @param {string} clientId - Client identifier
   * @param {number} requestId - Request identifier
   * @private
   */
  _untrackRequest(clientId, requestId) {
    const requests = this.activeRequests.get(clientId);
    if (requests) {
      requests.delete(requestId);
      if (requests.size === 0) {
        this.activeRequests.delete(clientId);
      }
    }
  }

  /**
   * Checks if a request is still active (not cancelled).
   *
   * @param {string} clientId - Client identifier
   * @param {number} requestId - Request identifier
   * @returns {boolean} True if request is active
   * @private
   */
  _isRequestActive(clientId, requestId) {
    return this.activeRequests.get(clientId)?.has(requestId) ?? false;
  }
}
