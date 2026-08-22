import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

/**
 * OpenAI provider implementation.
 *
 * Uses the OpenAI Responses API for basic text generation:
 * system prompt + user message -> assistant text.
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
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Sends completion request to OpenAI using the Responses API.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {string} [params.reasoning] - Reasoning effort level
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const systemPrompt = messages.find(m => m.role === 'system')?.content;
      const userMessage = messages
        .filter(m => m.role === 'user')
        .map(m => m.content)
        .join('\n');

      const requestPayload = {
        model: params.model,
        input: userMessage,
        max_output_tokens: params.max_tokens ?? 8192,
      };

      if (systemPrompt) {
        requestPayload.instructions = systemPrompt;
      }

      // Map reasoning effort to the Responses API reasoning config.
      // `minimal` is left unset to keep the model's default, matching the
      // previous chat completions behavior.
      if (params.reasoning && typeof params.reasoning === 'string') {
        requestPayload.reasoning = {
          effort: params.reasoning,
        };
      }

      const response = await this.client.responses.create(requestPayload);

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
   * Normalizes an OpenAI Responses API response.
   *
   * @param {Object} rawResponse - Raw response from OpenAI
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse.output_text !== 'string') {
      throw new Error('Invalid response: no output text returned from OpenAI');
    }

    let reasoning = null;

    if (Array.isArray(rawResponse.output)) {
      const reasoningTexts = [];

      for (const item of rawResponse.output) {
        if (item?.type !== 'reasoning') continue;

        const parts = Array.isArray(item.content) && item.content.length > 0
          ? item.content
          : item.summary;

        if (Array.isArray(parts)) {
          const text = parts
            .map(part => part?.text || '')
            .filter(Boolean)
            .join('\n');

          if (text) reasoningTexts.push(text);
        }
      }

      if (reasoningTexts.length > 0) {
        reasoning = reasoningTexts.join('\n');
      }
    }

    return {
      assistant: rawResponse.output_text || '',
      reasoning,
    };
  }
}
