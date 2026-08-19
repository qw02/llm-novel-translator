vi.mock('../../utils/api-key-manager.js');

import { getAllApiKeys } from "../../utils/api-key-manager.js";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
            const llmId = '1-1';
            const customParams = { temperature: 0.9 };

            getAllApiKeys.mockResolvedValue({});

            // Mock user params
            chrome.storage.local.get.mockResolvedValue({ userParams: {} });

            const config = await manager.resolveConfig(llmId, customParams);

            expect(config.providerType).toBe('openrouter');
            expect(config.endpoint).toBe(PROVIDER_CONFIGS.openrouter.endpoint);
            expect(config.params.model).toBe('deepseek/deepseek-v3.2');
            expect(config.params.temperature).toBe(0.9);
        });

        it('should merge parameters correctly (custom > user > model > default)', async () => {
            const llmId = '3-1';
            const customParams = { temperature: 0.1 }; // Highest priority

            // Mock user params
            chrome.storage.local.get.mockResolvedValue({
                userParams: { max_tokens: 100 } // Medium priority
            });

            const config = await manager.resolveConfig(llmId, customParams);

            expect(config.params.temperature).toBe(0.1); // From custom
            expect(config.params.max_tokens).toBe(100); // From user
            expect(config.params.model).toBe('deepseek-v4-flash'); // From model config
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

        it('should emit limits with sub-stage and fallback stage mapping', async () => {
            const models = await manager.getModelList({ showAll: false });

            // '1-4' is listed in openrouter stage2 + stage3a, others are 'all'
            const m14 = models.find(m => m.id === '1-4');
            expect(m14.limits).toEqual([1, 2, 3, 4, 5, 6]);

            // '1-8' is not in stage2/stage3a lists, but stage3b is 'all'
            const m18 = models.find(m => m.id === '1-8');
            expect(m18.limits).toEqual([1, 3, 4, 5, 6]);

            // Provider-fetched models have no limits field
            expect(models.every(m => m.source !== 'recommended' || Array.isArray(m.limits))).toBe(true);
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

    describe('deprecated models', () => {
        const deprecatedEntry = {
            id: '1-test-dep',
            model: 'deprecated/test-model',
            label: 'Deprecated Test Model',
            deprecated: true,
        };

        beforeEach(() => {
            PROVIDER_CONFIGS.openrouter.models.push(deprecatedEntry);
        });

        afterEach(() => {
            const idx = PROVIDER_CONFIGS.openrouter.models.indexOf(deprecatedEntry);
            if (idx !== -1) PROVIDER_CONFIGS.openrouter.models.splice(idx, 1);
        });

        it('getModelList should carry the deprecated flag', async () => {
            const models = await manager.getModelList({ showAll: false });

            const dep = models.find(m => m.id === '1-test-dep');
            expect(dep).toBeDefined();
            expect(dep.deprecated).toBe(true);

            const normal = models.find(m => m.id === '1-1');
            expect(normal.deprecated).toBe(false);
        });

        it('should still resolve a deprecated model for backend dispatch', async () => {
            getAllApiKeys.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({ userParams: {} });

            const config = await manager.resolveConfig('1-test-dep', {});

            expect(config.providerType).toBe('openrouter');
            expect(config.endpoint).toBe(PROVIDER_CONFIGS.openrouter.endpoint);
            expect(config.params.model).toBe('deprecated/test-model');
        });

        it('should not leak the deprecated flag into request params', async () => {
            getAllApiKeys.mockResolvedValue({});
            chrome.storage.local.get.mockResolvedValue({ userParams: {} });

            const config = await manager.resolveConfig('1-test-dep', {});

            expect(config.params).not.toHaveProperty('deprecated');
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
