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
      // {
      //   id: '1-1',
      //   model: 'moonshotai/kimi-k2-0905',
      //   label: 'Kimi K2 0905',
      //   providers: ['DeepInfra', 'Chutes'],
      // },
      {
        id: '101-1',
        model: 'deepseek/deepseek-v3.2-exp',
        label: 'DS V3.2 E / 99-1',
        providers: ['DeepInfra', 'NovitaAI', 'GMICloud', 'DeepSeek'],
      },
      {
        id: '101-2',
        model: 'deepseek/deepseek-v3.2-exp',
        label: 'DS V3.2 E / 99-1',
        providers: ['DeepInfra', 'NovitaAI', 'GMICloud', 'DeepSeek'],
      },
      {
        id: '101-3',
        model: 'deepseek/deepseek-v3.2-exp',
        label: 'DS V3.2 E / 99-1',
        providers: ['DeepInfra', 'NovitaAI', 'GMICloud', 'DeepSeek'],
      },
      {
        id: '101-4',
        model: 'deepseek/deepseek-v3.2-exp',
        label: 'DS V3.2 E / 99-1',
        providers: ['DeepInfra', 'NovitaAI', 'GMICloud', 'DeepSeek'],
      },
      {
        id: '101-5',
        model: 'deepseek/deepseek-v3.2-exp',
        label: 'DS V3.2 E / 99-1',
        providers: ['DeepInfra', 'NovitaAI', 'GMICloud', 'DeepSeek'],
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['1-4', '1-5', '1-8', '99-2'],
      stage3: ['1-1', '1-3', '1-6', '1-7', '1-8', '99-3'],
      stage4: 'all',
      stage5: 'all',
    },
  },

  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: [
      {
        id: '3-1',
        model: 'gpt-5',
        label: 'GPT-5 (R: Low)',
        reasoning: 'low',
      },
      {
        id: '3-2',
        model: 'gpt-5',
        label: 'GPT-5 (R: High)',
        reasoning: 'high',
        tokens: 8192,
      },
      {
        id: '3-3',
        model: 'gpt-5-mini',
        label: 'GPT-5 Mini (R: Off)',
        reasoning: 'minimal',
      },
      {
        id: '3-4',
        model: 'gpt-5-nano',
        label: 'GPT-5 Nano (R: Off)',
        reasoning: 'minimal',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['3-4'],
      stage3a: ['3-3', '3-4'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: [
      {
        id: '2-1',
        model: 'claude-3-5-sonnet-20241022',
        label: 'Claude 3.5 Sonnet',
        tokens: 8192,
      },
      {
        id: '2-2',
        model: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku',
      },
    ],
    limits: {
      stage1: 'all',
      stage2: ['2-2'],
      stage3a: ['2-2'],
      stage3b: 'all',
      stage4: 'all',
    },
  },

  deepseek: {
    endpoint: 'https://api.deepseek.com/v1',
    models: [
      {
        id: '4-1',
        model: 'deepseek-chat',
        label: 'DeepSeek V3.2 Exp (R: Off)'
      },
      // {
      //   id: '4-3',
      //   model: 'deepseek-reasoner',
      //   label: 'DeepSeek V3.2 Exp (R: On)',
      //   tokens: 8192,
      // },
    ],
    limits: {
      stage1: 'all',
      stage2: ['4-1'],
      stage3a: ['4-1'],
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
        label: 'Gemini Pro 2.5 (R: Med)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-2',
        model: 'gemini-2.5-pro',
        label: 'Gemini Pro 2.5 (R: Low)',
        reasoning: 'low',
      },
      {
        id: '6-3',
        model: 'gemini-2.5-flash-lite-preview-09-2025',
        label: 'Gemini Flash-Lite 2.5 (R: Med)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-4',
        model: 'gemini-2.5-flash-lite-preview-09-2025',
        label: 'Gemini Flash-Lite 2.5 (R: Off)',
        reasoning: 'minimal',
      },
      {
        id: '6-5',
        model: 'gemini-2.5-flash-preview-09-2025',
        label: 'Gemini Flash 2.5 (R: Med)',
        reasoning: 'medium',
        tokens: 8192,
      },
      {
        id: '6-6',
        model: 'gemini-2.5-flash-preview-09-2025',
        label: 'Gemini Flash 2.5 (R: Off)',
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

  xai: {
    endpoint: 'https://api.x.ai/v1',
    models: [
      {
        id: '5-1',
        model: 'grok-2-latest',
        label: 'Grok 2',
      },
      {
        id: '5-2',
        model: 'grok-2-mini-latest',
        label: 'Grok 2 Mini',
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

  ollama: {
    endpoint: 'http://localhost:11434/api/chat',
    models: [
      // Empty - user must configure custom models
    ],
    limits: {
      stage1: 'all',
      stage2: 'all',
      stage3a: 'all',
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
  max_tokens: 2048,
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

/**
 * Maps provider type to its SDK type for provider instantiation.
 * Used by LLMCoordinator to determine which provider class to use.
 */
export const PROVIDER_TYPE_MAP = {
  openai: 'openai',
  openrouter: 'openai',      // Uses OpenAI-compatible SDK
  deepseek: 'openai',        // Uses OpenAI-compatible SDK
  xai: 'openai',             // Uses OpenAI-compatible SDK
  anthropic: 'anthropic',
  google: 'google',
  ollama: 'ollama',
};
