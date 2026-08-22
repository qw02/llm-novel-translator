import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the OpenAI SDK to capture the request payload
const createMock = vi.fn();
vi.mock('openai', () => ({
    default: class {
        constructor() {
            this.chat = { completions: { create: createMock } };
        }
    },
}));

import { LocalProvider } from '../local-provider.js';
import { LOCAL_LLM_STORAGE_KEY } from '../../../common/local-llm-config.js';

function mockLocalConfig(config) {
    chrome.storage.local.get.mockImplementation((key) => {
        if (key === LOCAL_LLM_STORAGE_KEY) {
            return Promise.resolve({ [LOCAL_LLM_STORAGE_KEY]: config });
        }
        return Promise.resolve({});
    });
}

describe('LocalProvider', () => {
    let provider;

    const messages = [
        { role: 'system', content: 'You are a translator.' },
        { role: 'user', content: 'Translate this.' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        provider = new LocalProvider();

        createMock.mockResolvedValue({
            choices: [{ message: { content: 'translated text', reasoning_content: 'some reasoning' } }],
        });
    });

    it('should send messages plus extra params only', async () => {
        mockLocalConfig({
            enabled: true,
            port: 8080,
            extraParams: '{"model":"qwen3.8","foo":"bar"}',
        });

        const result = await provider.completion(messages, { model: 'ignored', max_tokens: 8192 });

        expect(createMock).toHaveBeenCalledWith({
            messages,
            model: 'qwen3.8',
            foo: 'bar',
        });
        expect(result.assistant).toBe('translated text');
        expect(result.reasoning).toBe('some reasoning');
    });

    it('should send only messages when extra params are blank', async () => {
        mockLocalConfig({
            enabled: true,
            port: 11434,
            extraParams: '',
        });

        await provider.completion(messages, {});

        expect(createMock).toHaveBeenCalledWith({ messages });
    });

    it('should throw when local LLM is disabled', async () => {
        mockLocalConfig({ enabled: false, port: 8080, extraParams: '' });

        await expect(provider.completion(messages, {})).rejects.toThrow('Local LLM is disabled');
        expect(createMock).not.toHaveBeenCalled();
    });

    it('should default to the default port when absent', async () => {
        mockLocalConfig({ enabled: true, extraParams: '' });

        await provider.completion(messages, {});

        expect(createMock).toHaveBeenCalledWith({ messages });
    });

    it('should throw on invalid extra params JSON', async () => {
        mockLocalConfig({ enabled: true, port: 8080, extraParams: '{oops' });

        await expect(provider.completion(messages, {})).rejects.toThrow('not valid JSON');
        expect(createMock).not.toHaveBeenCalled();
    });

    it('should throw when extra params is not a plain object', async () => {
        mockLocalConfig({ enabled: true, port: 8080, extraParams: '[1,2]' });

        await expect(provider.completion(messages, {})).rejects.toThrow('single JSON object');
        expect(createMock).not.toHaveBeenCalled();
    });

    describe('normalizeResponse', () => {
        it('should read reasoning from reasoning_content', () => {
            const result = provider.normalizeResponse({
                choices: [{ message: { content: 'a', reasoning_content: 'r' } }],
            });
            expect(result).toEqual({ assistant: 'a', reasoning: 'r' });
        });

        it('should fall back to reasoning field', () => {
            const result = provider.normalizeResponse({
                choices: [{ message: { content: 'a', reasoning: 'r2' } }],
            });
            expect(result).toEqual({ assistant: 'a', reasoning: 'r2' });
        });

        it('should throw on missing choices', () => {
            expect(() => provider.normalizeResponse({})).toThrow('no choices returned');
        });
    });
});
