import OpenAI from "openai";
import { BaseProvider } from './base-provider.js';

/**
 * xAI provider implementation.
 */
export class XaiProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'xai',
    });

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.endpoint,
    });
  }

  /**
   * Sends completion request to xAI.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const requestPayload = {
        model: params.model,
        messages: messages,
        max_completion_tokens: params.max_tokens ?? 4096,
      };

      console.log(`[xAI] Sending request:`, {
        model: params.model,
        messageCount: messages.length,
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
   * Normalizes xAI response.
   *
   * @param {Object} rawResponse - Raw response from xAI
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse.choices || rawResponse.choices.length === 0) {
      throw new Error('Invalid response: no choices returned from xAI');
    }

    const choice = rawResponse.choices[0];
    const message = choice.message;

    if (!message) {
      throw new Error('Invalid response: no message in choice');
    }

    if (message.refusal) {
      console.warn(`[xAI] Received response refusal: ${message.refusal}`);
    }

    return {
      assistant: message.content || '',
      reasoning: message.reasoning_content || null,
    };
  }
}
