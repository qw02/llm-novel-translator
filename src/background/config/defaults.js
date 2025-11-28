/**
 * Hard-coded provider recommended / default configurations.
 * These serve as the base configuration layer, providing:
 * - Recommended models for each provider
 * - Default endpoints
 * - Suggested stage limits (used by UI, not enforced by backend)
 * - Default parameters per model
 */

export const PROVIDER_CONFIGS = {
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1',
    models: [
      { id: '1-1', model: 'deepseek/deepseek-v3.2-exp', label: 'DeepSeek V3.2', providers: ['DeepInfra', 'SiliconFlow', 'NovitaAI', 'GMICloud', 'DeepSeek'] },
      { id: '1-2', model: 'moonshotai/kimi-k2-0905', label: 'Kimi K2', providers: ['DeepInfra', 'Chutes'] },
      { id: '1-3', model: 'google/gemini-3-pro-preview', label: 'Gemini 4 Pro', 'providers': ['Google', 'Google AI Studio'], tokens: 8192, reasoning: 'low' },
      { id: '1-4', model: 'google/gemini-2.5-flash-preview-09-2025', label: 'Gemini 2.5 Flash 2.5', 'providers': ['Google AI Studio', 'Google'] },
      { id: '1-5', model: 'google/gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash-Lite', 'providers': ['Google AI Studio', 'Google'] },
      { id: '1-6', model: 'x-ai/grok-4.1-fast', label: 'Grok 4.1 Fast', 'providers': ['xAI'], reasoning: true, tokens: 8192 },
      { id: '1-7', model: 'z-ai/glm-4.6', label: 'GLM 4.6', 'providers': ['z-ai'], tokens: 8192 },
      { id: '1-8', model: 'anthropic/claude-sonnet-4.5', label: 'Sonnet 4.5' },
    ],
    limits: {
      stage1: 'all',
      stage2: ['1-1', '1-4', '1-5'],
      stage3: ['1-1', '1-4', '1-5', '1-6'],
      stage4: 'all',
      stage5: 'all',
    },
  },

  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: [
      {
        id: '2-1',
        model: 'gpt-5.1',
        label: 'GPT-5.1 (Low)',
        reasoning: 'low',
      },
      {
        id: '2-2',
        model: 'gpt-5.1',
        label: 'GPT-5.1 (High)',
        reasoning: 'high',
        tokens: 8192,
      },
      {
        id: '2-3',
        model: 'gpt-5-mini',
        label: 'GPT-5 Mini (Minimal)',
        reasoning: 'minimal',
      },
      {
        id: '2-4',
        model: 'gpt-5-nano',
        label: 'GPT-5 Nano (Minimal)',
        reasoning: 'minimal',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['2-3', '2-4'],
      stage3a: ['2-3', '2-4'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

  deepseek: {
    endpoint: 'https://api.deepseek.com/v1',
    models: [
      {
        id: '3-1',
        model: 'deepseek-chat',
        label: 'DeepSeek V3.2 Exp (Non-reasoning)',
      },
      {
        id: '3-2',
        model: 'deepseek-reasoner',
        label: 'DeepSeek V3.2 Exp (Reasoning)',
        tokens: 8192,
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['3-1'],
      stage3a: ['3-1'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

  // ENHANCEMENT: Add support for NanoGPT as provider
  // nanogpt: {
  //   models: [
  //     { id: '4-1', model: 'deepseek-ai/deepseek-v3.2-exp', label: '[NG] DeepSeek V3.2 (R: Off)' },
  //   ],
  //   limits: {
  //     stage1: 'all',
  //     stage2: 'all',
  //     stage3a: 'all',
  //     stage3b: 'all',
  //     stage4: 'all',
  //   },
  // },

  xai: {
    endpoint: 'https://api.x.ai/v1',
    models: [
      {
        id: '5-1',
        model: 'grok-4-1-fast-reasoning',
        label: 'Grok 4.1 Fast (Reasoning)',
      },
      {
        id: '5-2',
        model: 'grok-4-1-fast-non-reasoning',
        label: 'Grok 4.1 Fast (Non-reasoning)',
      },
      {
        id: '5-3',
        model: 'grok-4-0709',
        label: 'Grok 4',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['5-2'],
      stage3a: ['5-2'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

  google: {
    endpoint: 'handled-by-sdk',
    models: [
      {
        id: '6-1',
        model: 'gemini-2.5-pro',
        label: 'Gemini Pro 2.5 (Medium)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-2',
        model: 'gemini-2.5-pro',
        label: 'Gemini Pro 2.5 (Low)',
        reasoning: 'low',
      },
      {
        id: '6-3',
        model: 'gemini-2.5-flash-lite-preview-09-2025',
        label: 'Gemini Flash-Lite 2.5 (Medium)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-4',
        model: 'gemini-2.5-flash-lite-preview-09-2025',
        label: 'Gemini Flash-Lite 2.5 (Non-reasoning)',
        reasoning: 'minimal',
      },
      {
        id: '6-5',
        model: 'gemini-2.5-flash-preview-09-2025',
        label: 'Gemini Flash 2.5 (Medium)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-6',
        model: 'gemini-2.5-flash-preview-09-2025',
        label: 'Gemini Flash 2.5 (Non-reasoning)',
        reasoning: 'minimal',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['6-4', '6-6'],
      stage3a: ['6-3', '6-4', '6-5', '6-6'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

};

/**
 * Default parameters used across all providers.
 * These are applied if not specified in model config, user overrides, or custom params.
 */
export const DEFAULT_PARAMS = {
  max_tokens: 4096,
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
