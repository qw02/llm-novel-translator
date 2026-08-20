import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

/**
 * NanoGPT provider implementation.
 *
 * NanoGPT exposes an OpenAI-compatible chat completions API at
 * https://nano-gpt.com/api/v1. This mirrors the OpenRouter provider without
 * the OpenRouter-specific `provider` routing and `reasoning` payload.
 */
export class NanoGptProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'nanogpt'
    });

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint,
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Sends completion request to NanoGPT.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const requestPayload = {
        model: params.model,
        messages: messages,
        temperature: params.temperature ?? 1.0,
        max_tokens: params.max_tokens ?? 8192,
      };

      if (params.reasoning) {
        if (typeof params.reasoning === 'string') {
          requestPayload.reasoning_effort = params.reasoning;
        }
      }

      const response = await this.client.chat.completions.create(requestPayload);

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
        models.push({
          provider: 'nanogpt',
          id: `nanogpt-${model.id}`, // id needs to be unique
          model: model.id,
          label: model.name || model.id,
        });
      }

      return models;

    } catch (error) {
      console.error('[NanoGPT] Failed to fetch models:', error.message);
      throw error;
    }
  }

  /**
   * Normalizes NanoGPT response.
   * NanoGPT returns an OpenAI-compatible format.
   *
   * @param {Object} rawResponse - Raw response from NanoGPT
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse.choices || rawResponse.choices.length === 0) {
      throw new Error('Invalid response: no choices returned from NanoGPT');
    }

    const choice = rawResponse.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error('Invalid response: no message in choice');
    }

    return {
      assistant: message.content || '',
      reasoning: message.reasoning || message.reasoning_content || null,
    };
  }
}
