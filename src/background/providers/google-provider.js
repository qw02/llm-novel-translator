import { GoogleGenAI } from '@google/genai';
import { BaseProvider } from './base-provider.js';

/**
 * Google Gemini provider implementation.
 *
 * Uses the Gemini Interactions API for text generation:
 * system instruction + user input -> assistant text.
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
   * @param {string} params.model - Model identifier (e.g., 'gemini-3.1-pro-preview')
   * @param {number} [params.temperature] - Sampling temperature
   * @param {number} [params.max_tokens] - Maximum tokens to generate
   * @param {string} [params.reasoning] - Thinking level ('minimal', 'low', 'medium', 'high')
   * @returns {Promise<Object>} Normalized response
   */
  async completion(messages, params) {
    try {
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const input = messages
        .filter(m => m.role !== 'system')
        .map(m => m.content)
        .join('\n');

      const generationConfig = {
        temperature: params.temperature ?? 1,
        max_output_tokens: params.max_tokens ?? 8192,
      };

      if (params.reasoning !== undefined && params.reasoning !== null) {
        generationConfig.thinking_level = params.reasoning;
      }

      const interaction = await this.ai.interactions.create({
        model: this._formatModel(params.model),
        input,
        generation_config: generationConfig,
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      });

      const normalized = this.normalizeResponse(interaction);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Normalizes a Google model identifier for the Interactions API.
   *
   * The Interactions API expects `models/<model-id>`. Older model configs may
   * include a `google/` vendor prefix (e.g. `google/gemini-3.7-flash`), which
   * is removed before the `models/` prefix is applied.
   *
   * @param {string} model - Raw model identifier from config
   * @returns {string} Google Interactions API model identifier
   * @private
   */
  _formatModel(model) {
    if (typeof model !== 'string' || !model) {
      throw new Error('Google model identifier is required');
    }

    const normalized = model.replace(/^google\//, '');

    if (normalized.startsWith('models/') || normalized.startsWith('tunedModels/')) {
      return normalized;
    }

    return `models/${normalized}`;
  }

  /**
   * Normalizes a Google Interactions API response to standard format.
   * Extracts both main content and available thinking summaries.
   *
   * @param {Object} rawResponse - Raw interaction response from @google/genai
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   */
  normalizeResponse(rawResponse) {
    if (!rawResponse || typeof rawResponse !== 'object') {
      throw new Error('Invalid response: no interaction returned from Google');
    }

    const assistant = typeof rawResponse.output_text === 'string'
      ? rawResponse.output_text
      : '';

    const reasoning = this._extractReasoning(rawResponse.steps);

    if (!assistant && !reasoning) {
      throw new Error('Invalid response: no text or thought content in interaction');
    }

    return {
      assistant,
      reasoning,
    };
  }

  /**
   * Extracts thinking summaries from interaction steps.
   *
   * @param {Array<Object>|undefined} steps - Interaction steps
   * @returns {string|null} Joined thinking summaries, or null if none found
   * @private
   */
  _extractReasoning(steps) {
    if (!Array.isArray(steps)) {
      return null;
    }

    const thoughtTexts = [];

    for (const step of steps) {
      if (!step || step.type !== 'thought' || !Array.isArray(step.summary)) {
        continue;
      }

      for (const item of step.summary) {
        if (item?.type === 'text' && typeof item.text === 'string' && item.text) {
          thoughtTexts.push(item.text);
        }
      }
    }

    return thoughtTexts.length > 0 ? thoughtTexts.join('\n') : null;
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
        error.message?.includes('thinkingLevel') ||
        error.message?.includes('thinking_level'))) {
      const enhancedError = new Error(
        'Invalid thinking configuration for Google model (check thinking level)',
      );
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Invalid model errors
    if (error.status === 404 || error.message?.includes('not found')) {
      const enhancedError = new Error(
        `Google model not found or not available: ${error.message}`,
      );
      enhancedError.originalError = error;
      enhancedError.provider = 'google';
      return enhancedError;
    }

    // Use base error handling for other cases
    return super.handleError(error);
  }
}
