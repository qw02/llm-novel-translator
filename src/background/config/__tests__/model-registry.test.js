import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelRegistry } from '../model-registry.js';

describe('ModelRegistry', () => {
    let registry;

    beforeEach(() => {
        vi.clearAllMocks();
        registry = new ModelRegistry();
    });

    describe('loadFromCache', () => {
        it('should return cached models from memory if available', async () => {
            const mockModels = [{ id: 'test-model' }];
            registry.cache.set('openai', mockModels);

            const result = await registry.loadFromCache('openai');
            expect(result).toEqual(mockModels);
            expect(chrome.storage.local.get).not.toHaveBeenCalled();
        });

        it('should return cached models from storage if not in memory', async () => {
            const mockModels = [{ id: 'test-model' }];
            chrome.storage.local.get.mockResolvedValue({ model_cache_openai: mockModels });

            const result = await registry.loadFromCache('openai');
            expect(result).toEqual(mockModels);
            expect(registry.cache.get('openai')).toEqual(mockModels);
        });

        it('should return null if not in cache or storage', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const result = await registry.loadFromCache('openai');
            expect(result).toBeNull();
        });
    });

    describe('saveToCache', () => {
        it('should save models to storage and memory', async () => {
            const mockModels = [{ id: 'test-model' }];
            await registry.saveToCache('openai', mockModels);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ model_cache_openai: mockModels });
            expect(registry.cache.get('openai')).toEqual(mockModels);
        });
    });

    describe('refreshModels', () => {
        it('should refresh models from provider instance', async () => {
            const mockModels = [{ id: 'new-model' }];
            const mockProvider = {
                getAvailableModels: vi.fn().mockResolvedValue(mockModels),
            };

            registry.providerInstances = new Map([['openai', mockProvider]]);

            const result = await registry.refreshModels('openai');

            expect(result).toEqual(mockModels);
            expect(mockProvider.getAvailableModels).toHaveBeenCalled();
            expect(registry.cache.get('openai')).toEqual(mockModels);
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ model_cache_openai: mockModels });
        });

        it('should fallback to cache if refresh fails', async () => {
            const mockModels = [{ id: 'cached-model' }];
            chrome.storage.local.get.mockResolvedValue({ model_cache_openai: mockModels });

            const mockProvider = {
                getAvailableModels: vi.fn().mockRejectedValue(new Error('Network error')),
            };
            registry.providerInstances = new Map([['openai', mockProvider]]);

            // Mock console.error to suppress output during test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const result = await registry.refreshModels('openai');

            expect(result).toEqual(mockModels);
            consoleSpy.mockRestore();
        });

        it('should throw error if refresh fails and no cache available', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const mockProvider = {
                getAvailableModels: vi.fn().mockRejectedValue(new Error('Network error')),
            };
            registry.providerInstances = new Map([['openai', mockProvider]]);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await expect(registry.refreshModels('openai')).rejects.toThrow('Network error');
            consoleSpy.mockRestore();
        });
    });

    describe('clearCache', () => {
        it('should clear cache for specific provider', async () => {
            registry.cache.set('openai', []);
            await registry.clearCache('openai');

            expect(chrome.storage.local.remove).toHaveBeenCalledWith('model_cache_openai');
            expect(registry.cache.has('openai')).toBe(false);
        });
    });

    describe('clearAllCaches', () => {
        it('should clear all model caches', async () => {
            chrome.storage.local.get.mockResolvedValue({
                model_cache_openai: [],
                other_key: 'value'
            });

            registry.cache.set('openai', []);

            await registry.clearAllCaches();

            expect(chrome.storage.local.remove).toHaveBeenCalledWith(['model_cache_openai']);
            expect(registry.cache.size).toBe(0);
        });
    });
});
