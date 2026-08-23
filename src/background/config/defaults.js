/**
 * Hard-coded provider recommended / default configurations.
 * These serve as the base configuration layer, providing:
 * - Recommended models for each provider
 * - Default endpoints
 * - Suggested stage limits (used by UI, not enforced by backend)
 * - Default parameters per model
 *
 * Deprecation convention (when updating the recommended list):
 * - Never delete or reassign a model `id` — stored user settings reference it.
 * - To phase a model out, keep the entry and add `deprecated: true`.
 *   It stays resolvable for backend request dispatch, but is hidden from the
 *   options-page model list, which instead shows a per-selector update prompt.
 */

export const PROVIDER_CONFIGS = {
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1',
    models: [
      { id: '1-1', model: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', providers: ['DeepInfra', 'SiliconFlow', 'NovitaAI', 'GMICloud', 'DeepSeek'], deprecated: true },
      { id: '1-2', model: 'moonshotai/kimi-k2-0905', label: 'Kimi K2', providers: ['DeepInfra', 'Chutes'], deprecated: true },
      { id: '1-3', model: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro', providers: ['Google', 'Google AI Studio'], tokens: 8192, reasoning: 'low', deprecated: true },
      { id: '1-4', model: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', providers: ['Google AI Studio', 'Google'], deprecated: true },
      { id: '1-5', model: 'google/gemini-2.5-flash-lite-preview-09-2025', label: 'Gemini 2.5 Flash-Lite', providers: ['Google AI Studio', 'Google'], deprecated: true },
      { id: '1-6', model: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast', 'providers': ['xAI'], reasoning: true, tokens: 8192 },
      { id: '1-7', model: 'z-ai/glm-4.7', label: 'GLM 4.7', 'providers': ['z-ai', 'novita/fp8', 'deepinfra/fp4'], tokens: 8192, deprecated: true },
      { id: '1-8', model: 'anthropic/claude-sonnet-4.5', label: 'Sonnet 4.5', deprecated: true },

      { id: '1-9',  model: 'z-ai/glm-5.3', label: 'GLM 5.3' },
      { id: '1-10', model: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash (Low)', providers: ['google-vertex/global'], reasoning: 'low' },
      { id: '1-11', model: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash (Medium)', providers: ['google-vertex/global'], reasoning: 'medium' },
      { id: '1-12', model: 'qwen/qwen3.8-2.4t-a95b', label: 'Qwen3.8 2.4T A95B' },
      { id: '1-13', model: 'deepseek/deepseek-v4-pro-0813', label: 'DeepSeek V4 Pro 0813' },
      { id: '1-14', model: 'deepseek/deepseek-v4-pro-0813', label: 'DeepSeek V4 Pro 0813 (Non-reasoning)', reasoning: 'none' },
      { id: '1-15', model: 'x-ai/grok-4.6', label: 'Grok 4.6' },
      { id: '1-16', model: '~deepseek/deepseek-v4-flash-latest', label: 'DeepSeek V4 Flash Latest' },
      { id: '1-17', model: '~deepseek/deepseek-v4-flash-latest', label: 'DeepSeek V4 Flash Latest (Non-reasoning)', reasoning: 'none' },
      { id: '1-18', model: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', reasoning: 'low' },
      { id: '1-19', model: 'moonshotai/kimi-k3', label: 'Kimi K3', providers: ['moonshotai/mxfp4', 'digitalocean', 'together', 'modal/mxfp4', 'baseten/fp8', 'fireworks', 'deepinfra/bf16'] },
      { id: '1-20', model: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna', reasoning: 'low' },
      { id: '1-21', model: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },

      // { id: '1-', model: '', label: '' },
    ],
    limits: {
      stage1: 'all',
      stage2: ['1-10', '1-11', '1-14', '1-16', '1-17', '1-18', '1-20'],
      stage3a: ['1-10','1-14', '1-17', '1-18', '1-20'],
      stage3b: ['1-10','1-14', '1-17', '1-18', '1-20'],
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  openai: {
    endpoint: 'https://api.openai.com/v1',
    models: [
      {
        id: '2-1',
        model: 'gpt-5.2',
        label: 'GPT-5.2 (Low)',
        reasoning: 'low',
        deprecated: true,
      },
      {
        id: '2-2',
        model: 'gpt-5.2',
        label: 'GPT-5.2 (High)',
        reasoning: 'high',
        tokens: 8192,
        deprecated: true,
      },
      {
        id: '2-3',
        model: 'gpt-5-mini',
        label: 'GPT-5 Mini (Minimal)',
        reasoning: 'minimal',
        deprecated: true,
      },
      {
        id: '2-4',
        model: 'gpt-5-nano',
        label: 'GPT-5 Nano (Minimal)',
        reasoning: 'minimal',
        deprecated: true,
      },
      {
        id: '2-5',
        model: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol (Minimal)',
        reasoning: 'minimal',
      },
      {
        id: '2-6',
        model: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra (Minimal)',
        reasoning: 'minimal',
      },
      {
        id: '2-7',
        model: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna (Minimal)',
        reasoning: 'minimal',
      },
      {
        id: '2-8',
        model: 'gpt-5.6-sol',
        label: 'GPT-5.6 Sol (Medium)',
        reasoning: 'medium',
      },
      {
        id: '2-9',
        model: 'gpt-5.6-terra',
        label: 'GPT-5.6 Terra (Medium)',
        reasoning: 'medium',
      },
      {
        id: '2-10',
        model: 'gpt-5.6-luna',
        label: 'GPT-5.6 Luna (Medium)',
        reasoning: 'medium',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['2-6', '2-7'],
      stage3a: ['2-6', '2-7', '2-9', '2-10'],
      stage3b: ['2-6', '2-7', '2-9', '2-10'],
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  deepseek: {
    // reasoning -> leave key out to inject thinking == false
    endpoint: 'https://api.deepseek.com/v1',
    models: [
      {
        id: '3-1',
        model: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash (Non-reasoning)',
      },
      {
        id: '3-2',
        model: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash (Low)',
        reasoning: 'low',
        tokens: 8192,
      },
      {
        id: '3-3',
        model: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash (High)',
        reasoning: 'high',
        tokens: 16384,
      },
      {
        id: '3-4',
        model: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro (Non-reasoning)',
      },
      {
        id: '3-5',
        model: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro (High)',
        reasoning: 'high',
        tokens: 8192,
      },
      {
        id: '3-6',
        model: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro (Max)',
        reasoning: 'max',
        tokens: 16384,
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['3-1', '3-4'],
      stage3a: ['3-1', '3-2', '3-4'],
      stage3b: ['3-1', '3-2', '3-4'],
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  nanogpt: {
    endpoint: 'https://nano-gpt.com/api/v1',
    models: [
      { id: '4-1', model: 'deepseek/deepseek-v4-flash-latest', label: 'DeepSeek V4 Flash Latest (Non-reasoning)', reasoning: 'none' },
      { id: '4-2', model: 'deepseek/deepseek-v4-flash-latest', label: 'DeepSeek V4 Flash Latest (Reasoning)', reasoning: 'medium' },
      { id: '4-3', model: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash (Low)', reasoning: 'low' },
      { id: '4-4', model: 'google/gemini-3.7-flash', label: 'Gemini 3.7 Flash (Medium)', reasoning: 'medium' },
    ],
    limits: {
      stage1: 'all',
      stage2: 'all',
      stage3a: 'all',
      stage3b: 'all',
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  xai: {
    endpoint: 'https://api.x.ai/v1',
    models: [
      {
        id: '5-1',
        model: 'grok-4.20-0309-reasoning',
        label: 'Grok 4.20 (Medium)',
        reasoning: 'medium',
      },
      {
        id: '5-2',
        model: 'grok-4.20-0309-reasoning',
        label: 'Grok 4.20 (Low)',
        reasoning: 'low',
      },
      {
        id: '5-3',
        model: 'grok-4.6',
        label: 'Grok 4.6',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['5-2'],
      stage3a: ['5-2'],
      stage3b: ['5-2'],
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  google: {
    endpoint: 'handled-by-sdk',
    models: [
      // PRO
      {
        id: '6-1',
        model: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro',
        reasoning: 'high',
        tokens: 8192,
      },
      {
        id: '6-2',
        model: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro (Low)',
        reasoning: 'low',
      },
      // Flash Lite
      {
        id: '6-3',
        model: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite (Medium)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-4',
        model: 'gemini-3.5-flash-lite',
        label: 'Gemini 3.5 Flash Lite (Non-reasoning)',
        reasoning: 'minimal',
      },
      // Flash
      {
        id: '6-5',
        model: 'google/gemini-3.7-flash',
        label: 'Gemini Flash 3.7 (Medium)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-6',
        model: 'google/gemini-3.7-flash',
        label: 'Gemini Flash 3.7 (Low)',
        reasoning: 'low',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['6-4', '6-6'],
      stage3a: ['6-3', '6-4', '6-5', '6-6'],
      stage3b: ['6-3', '6-4', '6-5', '6-6'],
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

  local: {
    // Endpoint is resolved per request from `local_llm_config` in storage;
    // see providers/local-provider.js. The pseudo-model below only appears
    // in the model list (and only resolves) when the feature is enabled —
    // gating lives in config-manager.js.
    endpoint: null,
    models: [
      { id: 'local-1', model: 'local', label: 'Local' },
    ],
    limits: {
      stage1: 'all',
      stage2: 'all',
      stage3a: 'all',
      stage3b: 'all',
      stage4: 'all',
      stage5: 'all',
      stage6: 'all',
    },
  },

};

/**
 * Default parameters used across all providers.
 * These are applied if not specified in model config, user overrides, or custom params.
 */
export const DEFAULT_PARAMS = {
  max_tokens: 8192,
};

/**
 * Rate limiting configuration.
 * Applied uniformly to all provider queues.
 */
export const RATE_LIMIT_CONFIG = {
  concurrency: 5,        // Max 5 concurrent requests per provider
  intervalCap: 10,       // Max 10 requests per interval
  interval: 1000,        // Interval in milliseconds (1 second)
};
