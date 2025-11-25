vi.mock('../../utils/api-key-manager.js');

import { getAllApiKeys } from "../../utils/api-key-manager.js";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigManager } from '../config-manager.js';
import { PROVIDER_CONFIGS } from '../defaults.js';

// Mock ApiKeyManager
vi.mock('../../utils/api-key-manager.js', () => ({
    getApiKey: vi.fn(),
    getAllApiKeys: vi.fn(),
}));

describe('ConfigManager', () => {
    let manager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new ConfigManager();
    });

    describe('resolveConfig', () => {
        it('should resolve hardcoded model config', async () => {
            const llmId = '1-1'; // DeepSeek model from defaults
            const customParams = { temperature: 0.9 };

            getAllApiKeys.mockResolvedValue({});

            // Mock user params
            chrome.storage.local.get.mockResolvedValue({ userParams: {} });

            const config = await manager.resolveConfig(llmId, customParams);

            expect(config.providerType).toBe('openrouter');
            expect(config.endpoint).toBe(PROVIDER_CONFIGS.openrouter.endpoint);
            expect(config.params.model).toBe('moonshotai/kimi-k2-0905');
            expect(config.params.temperature).toBe(0.9);
        });

        it('should merge parameters correctly (custom > user > model > default)', async () => {
            const llmId = '3-1'; // GPT-5
            const customParams = { temperature: 0.1 }; // Highest priority

            // Mock user params
            chrome.storage.local.get.mockResolvedValue({
                userParams: { max_tokens: 100 } // Medium priority
            });

            const config = await manager.resolveConfig(llmId, customParams);

            expect(config.params.temperature).toBe(0.1); // From custom
            expect(config.params.max_tokens).toBe(100); // From user
            expect(config.params.model).toBe('gpt-5'); // From model config
        });
    });

    describe('getModelList', () => {
        it('should return recommended models', async () => {
            const models = await manager.getModelList({ showAll: false });

            // Should contain at least one model from defaults
            expect(models.length).toBeGreaterThan(0);
            expect(models[0]).toHaveProperty('id');
            expect(models[0]).toHaveProperty('label');
            expect(models[0].source).toBe('recommended');
        });

        it('should include cached models if showAll is true', async () => {
            // Mock API keys to simulate available providers
            getAllApiKeys.mockResolvedValue({ openai: 'sk-key' });

            // Mock cached models
            const cachedModels = [{ id: 'cached-gpt', model: 'gpt-cached', label: 'Cached GPT' }];
            chrome.storage.local.get.mockImplementation((key) => {
                if (key === 'model_cache_openai') return Promise.resolve({ model_cache_openai: cachedModels });
                return Promise.resolve({});
            });

            const models = await manager.getModelList({ showAll: true });

            const cached = models.find(m => m.id === 'cached-gpt');
            expect(cached).toBeDefined();
            expect(cached.source).toBe('provider');
        });
    });

    describe('refreshModelList', () => {
        it('should skip providers without API keys', async () => {
            getAllApiKeys.mockResolvedValue({}); // No keys

            const mockProviderClass = vi.fn();
            const providerRegistry = { openai: mockProviderClass };

            const results = await manager.refreshModelList(providerRegistry);

            expect(results.success).toHaveLength(0);
            expect(mockProviderClass).not.toHaveBeenCalled();
        });
    });
});
