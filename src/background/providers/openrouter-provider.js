import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

/**
 * OpenRouter provider implementation.
 *
 * Reasoning config can be:
 * - boolean: true enables reasoning with defaults
 * - string: sets reasoning effort level ('low', 'medium', 'high')
 * - number: sets max reasoning tokens
 * - false/undefined: reasoning disabled
 */
export class OpenRouterProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'openrouter'
    });

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint,
      // defaultHeaders: {
      //   'HTTP-Referer': 'https://github.com/qw02/llm-novel-translator',
      //   'X-Title': 'LLM Novel Translator',
      // },
    });
  }

  /**
   * Sends completion request to OpenRouter.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.top_p] - Nucleus sampling parameter
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {Array<string>} [params.providers] - Preferred provider routing order
   * @param {boolean|string|number} [params.reasoning] - Reasoning configuration
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const requestPayload = {
        model: params.model,
        messages: messages,
        temperature: params.temperature ?? 0.6,
        max_tokens: params.max_tokens ?? 4096,
      };

      // Add provider routing preference if specified
      if (params.providers && Array.isArray(params.providers)) {
        requestPayload.provider = {
          order: params.providers,
          allow_fallbacks: false,
        };
      }

      // Handle reasoning configuration
      const reasoningConfig = this._buildReasoningConfig(params.reasoning);
      if (reasoningConfig) {
        requestPayload.reasoning = reasoningConfig;
      }

      // Make API call
      const response = await this.client.chat.completions.create(requestPayload);

      // Normalize and log response
      const normalized = this.normalizeResponse(response);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAvailableModels() {
    try {
      const response = await this.client.models.list();

      const models = [];

      for (const model of response.data) {
        // Only include text -> text models
        if (model.architecture.input_modalities.includes('text') && model.architecture.output_modalities.includes('text')) {
          models.push({
            provider: 'openrouter',
            id: `openrouter-${model.id}`, // id needs to be unique
            model: model.id,
            label: model.name,
          })
        }
      }

      return models;

    } catch (error) {
      console.error('[OpenAI] Failed to fetch models:', error.message);
      throw error;
    }
  }

  /**
   * Builds reasoning configuration for OpenRouter.
   *
   * @param {boolean|string|number|undefined} reasoningParam - Reasoning config from model
   * @returns {Object|null} Reasoning payload or null if disabled
   * @private
   */
  _buildReasoningConfig(reasoningParam) {
    if (reasoningParam === undefined || reasoningParam === false) {
      return null;
    }

    const reasoningPayload = {};
    const configType = typeof reasoningParam;

    if (configType === 'boolean' && reasoningParam === true) {
      // Enable with defaults
      reasoningPayload.enabled = true;
    } else if (configType === 'number') {
      // Set max tokens for reasoning
      reasoningPayload.max_tokens = reasoningParam;
    } else if (configType === 'string') {
      // Set effort level (low, medium, high)
      reasoningPayload.effort = reasoningParam;
    } else {
      console.warn(`[OpenRouter] Invalid reasoning config type: ${configType}`, reasoningParam);
      return null;
    }

    return reasoningPayload;
  }

  /**
   * Normalizes OpenRouter response.
   * OpenRouter returns OpenAI-compatible format.
   *
   * @param {Object} rawResponse - Raw response from OpenRouter
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse.choices || rawResponse.choices.length === 0) {
      throw new Error('Invalid response: no choices returned from OpenRouter');
    }

    const choice = rawResponse.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error('Invalid response: no message in choice');
    }

    return {
      assistant: message.content || '',
      reasoning: message.reasoning || null,
    };
  }
}
