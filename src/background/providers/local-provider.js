import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';
import { getLocalLlmConfig, parseExtraParams } from '../../common/local-llm-config.js';

/**
 * Local LLM provider implementation.
 *
 * Talks to any OpenAI-compatible chat completions endpoint (llama.cpp,
 * KoboldCpp, Ollama, …). Endpoint and extra request params are read from
 * chrome.storage on every request, so config changes take effect immediately
 * even though the coordinator caches provider instances.
 *
 * The request payload is intentionally minimal: `messages` plus whatever the
 * user put in the extra-params field (merged as-is, including the `model`
 * key). Per-stage resolved params (temperature, max_tokens, reasoning, …)
 * are ignored — the same extra params apply to all stages.
 */
export class LocalProvider extends BaseProvider {
  constructor() {
    super({
      endpoint: null, // resolved per request from local_llm_config
      apiKey: 'local',
      providerType: 'local',
    });
  }

  /**
   * Sends a chat completion request to the configured local endpoint.
   *
   * @param {Array<Object>} messages - Messages array with role and content
   * @param {Object} params - Resolved request parameters (ignored for local)
   * @returns {Promise<Object>} Normalized response: { assistant, reasoning }
   */
  async completion(messages, params) {
    try {
      const config = await getLocalLlmConfig();

      if (!config.enabled) {
        throw new Error('Local LLM is disabled. Enable it in the API Keys tab.');
      }
      if (!config.endpoint) {
        throw new Error('Local LLM endpoint is not configured.');
      }

      const client = new OpenAI({
        apiKey: 'local',
        baseURL: config.endpoint,
        dangerouslyAllowBrowser: true,
      });

      const requestPayload = {
        messages,
        ...parseExtraParams(config.extraParams),
      };

      const response = await client.chat.completions.create(requestPayload);

      const normalized = this.normalizeResponse(response);
      this.logInteraction(messages, normalized.assistant, normalized.reasoning);

      return normalized;

    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Normalizes an OpenAI-compatible chat completion response.
   * Local engines variously return reasoning in `reasoning_content`
   * (llama.cpp / KoboldCpp) or `reasoning`.
   *
   * @param {Object} rawResponse - Raw response from the local server
   * @returns {Object} Normalized response: { assistant, reasoning }
   */
  normalizeResponse(rawResponse) {
    const choice = rawResponse.choices?.[0];
    if (!choice) {
      throw new Error('Invalid response: no choices returned');
    }

    return {
      assistant: choice.message?.content || '',
      reasoning: choice.message?.reasoning_content || choice.message?.reasoning || null,
    };
  }
}
