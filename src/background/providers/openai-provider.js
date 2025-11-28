import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

/**
 * OpenAI provider implementation.
 */
export class OpenAIProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'openai',
    });

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint,
    });
  }

  /**
   * Sends completion request to OpenAI.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.top_p] - Nucleus sampling parameter
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {string} [params.reasoning] - Reasoning effort level
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      // Build request payload
      const requestPayload = {
        model: params.model,
        messages: messages,
        max_tokens: params.max_tokens ?? 4096,
      };

      // Add reasoning effort if specified
      if (params.reasoning && params.reasoning !== 'minimal') {
        requestPayload.reasoning_effort = params.reasoning;
      }

      const response = await this.client.chat.completions.create(requestPayload);

      const normalized = this.normalizeResponse(response);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetches available models from OpenAI API.
   *
   * @returns {Promise<Array<Object>>} Array of model configs
   */
  async getAvailableModels() {
    try {
      const response = await this.client.models.list();
      const models = [];

      for (const model of response.data) {
        // Filter to only include chat models
        if (model.id.includes('gpt') || model.id.includes('o1') || model.id.includes('o3')|| model.id.includes('o4')) {
          models.push({
            provider: 'openai',
            id: `openai-${model.id}`,  // Prefix to ensure uniqueness
            model: model.id,
            label: this._formatModelLabel(model.id),
          });
        }
      }

      return models;

    } catch (error) {
      console.error('[OpenAI] Failed to fetch models:', error.message);
      throw error;
    }
  }

  /**
   * Formats model ID into a readable label.
   *
   * @param {string} modelId - Model identifier from API
   * @returns {string} Formatted label
   * @private
   */
  _formatModelLabel(modelId) {
    // Simple formatting: capitalize and remove dashes
    return modelId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Normalizes OpenAI response.
   * Uses base class implementation as OpenAI format is the standard.
   *
   * @param {Object} rawResponse - Raw response from OpenAI
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse.choices || rawResponse.choices.length === 0) {
      throw new Error('Invalid response: no choices returned from OpenAI');
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
