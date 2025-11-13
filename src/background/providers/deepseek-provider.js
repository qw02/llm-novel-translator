import OpenAI from "openai";
import { BaseProvider } from './base-provider.js';

/**
 * DeepSeek provider implementation.
 */
export class DeepSeekProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'deepseek',
    });

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint,
    });
  }

  /**
   * Sends completion request to DeepSeek.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.top_p] - Nucleus sampling parameter
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {boolean|number} [params.reasoning] - Reasoning configuration
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const requestPayload = {
        model: params.model,
        messages: messages,
        temperature: params.temperature ?? 1.0,
        max_tokens: params.max_tokens ?? 4096,
      };

      console.log(`[DeepSeek] Sending request:`, {
        model: params.model,
        messageCount: messages.length,
        reasoning: params.reasoning,
      });

      const response = await this.client.chat.completions.create(requestPayload);

      const normalized = this.normalizeResponse(response);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Normalizes DeepSeek response.
   * DeepSeek returns reasoning in reasoning_content field.
   *
   * @param {Object} rawResponse - Raw response from DeepSeek
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse.choices || rawResponse.choices.length === 0) {
      throw new Error('Invalid response: no choices returned from DeepSeek');
    }

    const choice = rawResponse.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error('Invalid response: no message in choice');
    }

    return {
      assistant: message.content || '',
      reasoning: message.reasoning_content || null,
    };
  }
}