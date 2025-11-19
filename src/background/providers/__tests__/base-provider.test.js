import { describe, it, expect, vi } from 'vitest';
import { BaseProvider } from '../base-provider.js';

// Concrete implementation for testing abstract class
class TestProvider extends BaseProvider {
    constructor(config) {
        super(config);
    }

    async completion(messages, params) {
        return { assistant: 'test response', reasoning: null };
    }
}

describe('BaseProvider', () => {
    const config = {
        endpoint: 'https://api.test.com',
        apiKey: 'test-key',
        providerType: 'test-provider',
    };

    it('should throw error if instantiated directly', () => {
        expect(() => new BaseProvider(config)).toThrow('BaseProvider is abstract');
    });

    it('should initialize properties correctly in subclass', () => {
        const provider = new TestProvider(config);
        expect(provider.endpoint).toBe(config.endpoint);
        expect(provider.apiKey).toBe(config.apiKey);
        expect(provider.providerType).toBe(config.providerType);
    });

    describe('buildMessages', () => {
        it('should build messages with system prompt', () => {
            const provider = new TestProvider(config);
            const messages = provider.buildMessages('System prompt', 'User message');

            expect(messages).toHaveLength(2);
            expect(messages[0]).toEqual({ role: 'system', content: 'System prompt' });
            expect(messages[1]).toEqual({ role: 'user', content: 'User message' });
        });

        it('should build messages without system prompt', () => {
            const provider = new TestProvider(config);
            const messages = provider.buildMessages(null, 'User message');

            expect(messages).toHaveLength(1);
            expect(messages[0]).toEqual({ role: 'user', content: 'User message' });
        });
    });

    describe('normalizeResponse', () => {
        it('should normalize standard OpenAI-like response', () => {
            const provider = new TestProvider(config);
            const rawResponse = {
                choices: [{
                    message: {
                        content: 'Hello',
                        reasoning: 'Thinking...',
                    }
                }]
            };

            const result = provider.normalizeResponse(rawResponse);
            expect(result).toEqual({
                assistant: 'Hello',
                reasoning: 'Thinking...',
            });
        });

        it('should throw error for invalid response', () => {
            const provider = new TestProvider(config);
            expect(() => provider.normalizeResponse({})).toThrow('Invalid response');
        });
    });

    describe('handleError', () => {
        it('should normalize 401 error', () => {
            const provider = new TestProvider(config);
            const error = new Error('Unauthorized');
            error.status = 401;

            const result = provider.handleError(error);
            expect(result.message).toContain('Authentication failed');
            expect(result.provider).toBe(config.providerType);
        });

        it('should normalize 429 error', () => {
            const provider = new TestProvider(config);
            const error = new Error('Too Many Requests');
            error.status = 429;

            const result = provider.handleError(error);
            expect(result.message).toContain('Rate limit exceeded');
        });

        it('should normalize network error', () => {
            const provider = new TestProvider(config);
            const error = new Error('Network Error');
            error.code = 'ECONNREFUSED';

            const result = provider.handleError(error);
            expect(result.message).toContain('Network error');
        });
    });
});
