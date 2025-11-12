/**
 * Abstract base class for all LLM providers.
 *
 * Each provider implementation must:
 * 1. Initialize its SDK client in the constructor
 * 2. Implement the completion() method
 * 3. Normalize responses to the standard format
 *
 */
export class BaseProvider {
  /**
   * @param {Object} config
   * @param {string} config.endpoint - API endpoint URL
   * @param {string} config.apiKey - API key for authentication
   * @param {string} config.providerType - Provider type identifier
   */
  constructor({ endpoint, apiKey, providerType }) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }

    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.providerType = providerType;

    // Subclasses should initialize their SDK client here
    // Example: this.client = new OpenAI({ apiKey, baseURL: endpoint });
  }

  /**
   * Sends a completion request to the LLM.
   * Must be implemented by subclasses.
   *
   * @param {Array<Object>} messages - Array of message objects with role and content
   * @param {Object} params - Request parameters (model, temperature, max_tokens, etc.)
   * @returns {Promise<Object>} Normalized response: { assistant: string, reasoning: string | null }
   * @throws {Error} If not implemented or if request fails
   */
  async completion(messages, params) {
    throw new Error('completion() must be implemented by subclass');
  }

  /**
   * Normalizes a provider-specific response to the standard format.
   * Can be overridden by subclasses for provider-specific extraction logic.
   *
   * @param {Object} rawResponse - The raw response from the provider's SDK
   * @returns {Object} Normalized response: { assistant: string, reasoning: string | null }
   * @protected
   */
  normalizeResponse(rawResponse) {
    // Default implementation for OpenAI-compatible responses
    const choice = rawResponse.choices?.[0];
    if (!choice) {
      throw new Error('Invalid response: no choices returned');
    }

    return {
      assistant: choice.message?.content || '',
      reasoning: choice.message?.reasoning || null,
    };
  }

  /**
   * Builds the messages array in the standard format.
   * Helper method for subclasses.
   *
   * @param {string} systemPrompt - The system instruction
   * @param {string} userMessage - The user's message
   * @returns {Array<Object>} Array of message objects
   * @protected
   */
  buildMessages(systemPrompt, userMessage) {
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
   * Logs interaction details for debugging.   *
   * @param {Array<Object>} messages - The messages sent
   * @param {string} completion - The assistant's response
   * @param {string|null} reasoning - The reasoning content (if any)
   * @protected
   */
  logInteraction(messages, completion, reasoning) {
    // TODO: Check debug flag form storage
    // >> Option bool set from options page

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsg = messages.find(m => m.role === 'user')?.content || '';

    const sections = [];

    if (systemMsg) {
      sections.push({ title: '[System]', content: systemMsg });
    }

    if (userMsg) {
      sections.push({ title: '[User]', content: userMsg });
    }

    if (reasoning) {
      sections.push({ title: '[Reasoning]', content: reasoning });
    }

    if (completion) {
      sections.push({ title: '[Assistant]', content: completion });
    }

    if (sections.length === 0) return;

    const logText = sections
      .map(section => `${section.title}:\n${section.content}`)
      .join('\n' + '-'.repeat(80) + '\n');

    console.log(
      '[Background] LLM Request log' + '\n' +
      '='.repeat(80) + '\n' +
      `[${this.providerType}]` + '\n' +
      logText + '\n' +
      '='.repeat(80)
    );
  }

  /**
   * Handles errors from provider SDKs and normalizes them.
   *
   * @param {Error} error - The error from the SDK
   * @returns {Error} A normalized error with consistent message format
   * @protected
   */
  handleError(error) {
    console.error(`[${this.providerType}] Request failed:`, error);

    // Extract meaningful error message
    let errorMessage = error.message || 'Unknown error';

    // Check for common error types
    if (error.status === 401 || error.status === 403) {
      errorMessage = `Authentication failed: Invalid API key for ${this.providerType}`;
    } else if (error.status === 429) {
      errorMessage = `Rate limit exceeded for ${this.providerType}`;
    } else if (error.status >= 500) {
      errorMessage = `${this.providerType} server error: ${error.message}`;
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      errorMessage = `Network error: Cannot reach ${this.providerType} endpoint`;
    }

    // Create new error with normalized message
    const normalizedError = new Error(errorMessage);
    normalizedError.originalError = error;
    normalizedError.provider = this.providerType;

    return normalizedError;
  }
}