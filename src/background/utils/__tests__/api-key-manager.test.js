import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getApiKey, saveApiKeys, getAllApiKeys } from '../api-key-manager.js';

describe('api-key-manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getApiKey', () => {
        it('should return the api key if it exists', async () => {
            const mockKeys = { openai: 'sk-test-key' };
            chrome.storage.local.get.mockResolvedValue({ api_keys: mockKeys });

            const key = await getApiKey('openai');
            expect(key).toBe('sk-test-key');
            expect(chrome.storage.local.get).toHaveBeenCalledWith('api_keys');
        });

        it('should throw an error if the api key does not exist', async () => {
            chrome.storage.local.get.mockResolvedValue({ api_keys: {} });

            await expect(getApiKey('openai')).rejects.toThrow('API key not found for provider: openai');
        });

        it('should throw an error if no api keys are stored', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            await expect(getApiKey('openai')).rejects.toThrow('API key not found for provider: openai');
        });
    });

    describe('saveApiKeys', () => {
        it('should save api keys to storage', async () => {
            const keys = { openai: 'sk-new-key' };
            await saveApiKeys(keys);

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ api_keys: keys });
        });
    });

    describe('getAllApiKeys', () => {
        it('should return all stored api keys', async () => {
            const mockKeys = { openai: 'sk-key-1', anthropic: 'sk-key-2' };
            chrome.storage.local.get.mockResolvedValue({ api_keys: mockKeys });

            const keys = await getAllApiKeys();
            expect(keys).toEqual(mockKeys);
        });

        it('should return empty object if no keys are stored', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const keys = await getAllApiKeys();
            expect(keys).toEqual({});
        });
    });
});
