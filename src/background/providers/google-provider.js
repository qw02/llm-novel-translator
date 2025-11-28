import { GoogleGenAI } from '@google/genai';
import { BaseProvider } from './base-provider.js';

/**
 * Google Gemini provider implementation.
 *
 */
export class GoogleProvider extends BaseProvider {
  constructor({ endpoint, apiKey }) {
    super({
      endpoint,
      apiKey,
      providerType: 'google',
    });

    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  /**
   * Sends completion request to Google Gemini.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model identifier (e.g., 'gemini-2.5-pro')
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.top_p] - Nucleus sampling parameter
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {string} [params.reasoning] - Reasoning mode ('minimal', 'low', 'medium', 'high')
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const userMessages = messages.filter(m => m.role !== 'system');

      const contents = this._convertMessagesToGoogleFormat(userMessages);

      const config = {
        maxOutputTokens: params.max_tokens ?? 4096,
      };

        if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const thinkingBudget = this._mapReasoningToThinkingBudget(params.reasoning);
      if (thinkingBudget !== null) {
        config.thinkingConfig = {
          thinkingBudget: thinkingBudget,
        };
      }

      const response = await this.ai.models.generateContent({
        model: params.model,
        contents: contents,
        config: config,
      });

      const normalized = this.normalizeResponse(response);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Converts standard messages format to Google's contents format.
   * Google uses: [{ role: 'user'|'model', parts: [{ text: '...' }] }]
   *
   * @param {Array<Object>} messages - Standard messages array
   * @returns {Array<Object>} Google-formatted contents array
   * @private
   */
  _convertMessagesToGoogleFormat(messages) {
    return messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
  }

  /**
   * Maps reasoning mode to Google's thinking budget (token count).
   *
   * Budget allocation:
   * - minimal: 0 (disable thinking for faster responses)
   * - low: 128 (minimum thinking, required for gemini-2.5-pro)
   * - medium: 1024 (balanced reasoning)
   * - high: 8192 (deep reasoning)
   *
   * @param {string|undefined} reasoning - Reasoning config
   * @returns {number|null} Thinking budget in tokens, or null if not specified
   * @private
   */
  _mapReasoningToThinkingBudget(reasoning) {
    if (reasoning === undefined) {
      return null; // Use default at Google's inference engine side
    }

    const budgetMap = {
      minimal: 0,      // Disable thinking (not allowed for gemini-2.5-pro)
      low: 128,        // Minimum thinking
      medium: 1024,    // Balanced
      high: 8192,      // Maximum
    };

    const budget = budgetMap[reasoning];

    if (budget === undefined) {
      console.warn(`[Google] Unknown reasoning mode: ${reasoning}, using default`);
      return null;
    }

    return budget;
  }

  /**
   * Normalizes Google response to standard format.
   * Extracts both main content and thinking/reasoning parts.
   *
   * @param {Object} rawResponse - Raw response from @google/genai
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    const candidate = rawResponse.candidates?.[0];

    if (!candidate) {
      throw new Error('Invalid response: no candidates returned from Google');
    }

    const content = candidate.content;
    if (!content || !content.parts || content.parts.length === 0) {
      throw new Error('Invalid response: no content parts returned');
    }

    // Extract main text content (parts with 'text' field)
    const textParts = content.parts.filter(part => part.text);
    const assistant = textParts.map(part => part.text).join('');

    // Extract thinking/reasoning content (parts with 'thought' field)
    const thinkingParts = content.parts.filter(part => part.thought);
    const reasoning = thinkingParts.length > 0
                      ? thinkingParts.map(part => part.thought).join('\n')
                      : null;

    if (!assistant && !reasoning) {
      throw new Error('Invalid response: no text or thought content in parts');
    }

    return {
      assistant: assistant || '',
      reasoning,
    };
  }

  /**
   * Enhanced error handling for Google-specific errors.
   *
   * @param {Error} error - The error from Google SDK
   * @returns {Error} Normalized error
   */
  handleError(error) {
    console.error(`[Google] Request failed:`, error);

    // Google SDK returns ApiError with status and message

    // Authentication errors
    if (error.message?.includes('API_KEY_INVALID') ||
      error.message?.includes('invalid API key') ||
      error.status === 403) {
      const enhancedError = new Error('Authentication failed: Invalid API key for Google');
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Rate limiting errors
    if (error.message?.includes('RATE_LIMIT_EXCEEDED') ||
      error.message?.includes('rate limit') ||
      error.status === 429) {
      const enhancedError = new Error('Rate limit exceeded for Google');
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Invalid thinking configuration
    if (error.status === 400 &&
      (error.message?.includes('thinking') ||
        error.message?.includes('thinkingBudget'))) {
      const enhancedError = new Error(
        'Invalid thinking configuration for Google model (check thinking budget limits)'
      );
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Invalid model errors
    if (error.status === 404 || error.message?.includes('not found')) {
      const enhancedError = new Error(
        `Google model not found or not available: ${error.message}`
      );
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Use base error handling for other cases
    return super.handleError(error);
  }
}
