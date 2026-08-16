import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));

vi.mock('../../llm-client.js', () => ({
  LLMClient: class {
    constructor() {
      this.request = mockRequest;
    }
    dispose() {}
  },
}));

import {
  requestWithRetry,
  requestBatchWithRetry,
  isUnparseableJSON,
  isMalformedTranslation,
  isMalformedOperations,
} from '../llm-retry.js';

const fakeClient = { request: (...args) => mockRequest(...args) };

/** Helper to build a normalized LLMClient.response value. */
const resp = (assistant, reasoning = null) => ({ assistant, reasoning });

describe('requestWithRetry', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns immediately when the first response is well-formed', async () => {
    mockRequest.mockResolvedValueOnce(resp('good'));

    const res = await requestWithRetry({
      client: fakeClient,
      prompt: { system: 's', user: 'u' },
      isMalformed: (raw) => raw !== 'good',
    });

    expect(res).toEqual({ raw: 'good', attempts: 1, usedFallback: false, malformed: false });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('retries the same request once on malformed output', async () => {
    mockRequest
      .mockResolvedValueOnce(resp('junk'))
      .mockResolvedValueOnce(resp('good'));

    const res = await requestWithRetry({
      client: fakeClient,
      prompt: { system: 's', user: 'u' },
      isMalformed: (raw) => raw === 'junk',
    });

    expect(res.raw).toBe('good');
    expect(res.attempts).toBe(2);
    expect(res.usedFallback).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback model on the third attempt', async () => {
    mockRequest
      .mockResolvedValueOnce(resp('junk'))
      .mockResolvedValueOnce(resp('junk'))
      .mockResolvedValueOnce(resp('good'));

    const res = await requestWithRetry({
      client: fakeClient,
      fallbackLlmId: 'fb-1',
      stageId: '4',
      stageLabel: 'Translation',
      prompt: { system: 's', user: 'u' },
      isMalformed: (raw) => raw === 'junk',
    });

    expect(res.raw).toBe('good');
    expect(res.attempts).toBe(3);
    expect(res.usedFallback).toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('reuses the primary model on attempt 3 when no fallback is configured', async () => {
    mockRequest
      .mockResolvedValueOnce(resp('junk'))
      .mockResolvedValueOnce(resp('junk'))
      .mockResolvedValueOnce(resp('good'));

    const res = await requestWithRetry({
      client: fakeClient,
      fallbackLlmId: null,
      prompt: { system: 's', user: 'u' },
      isMalformed: (raw) => raw === 'junk',
    });

    expect(res.raw).toBe('good');
    expect(res.usedFallback).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('returns malformed: true with the last raw output after 3 malformed attempts', async () => {
    mockRequest.mockResolvedValue(resp('junk'));

    const res = await requestWithRetry({
      client: fakeClient,
      prompt: { system: 's', user: 'u' },
      isMalformed: () => true,
    });

    expect(res.malformed).toBe(true);
    expect(res.attempts).toBe(3);
    expect(res.raw).toBe('junk');
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('logs the malformed response body and reasoning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRequest.mockResolvedValue(resp('junk', 'thinking...'));

    await requestWithRetry({
      client: fakeClient,
      prompt: { system: 's', user: 'u' },
      isMalformed: () => true,
    });

    const output = warnSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(output).toContain('junk');
    expect(output).toContain('thinking...');
    warnSpy.mockRestore();
  });

  it('omits the reasoning section when the model returns none', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRequest.mockResolvedValue(resp('junk', null));

    await requestWithRetry({
      client: fakeClient,
      prompt: { system: 's', user: 'u' },
      isMalformed: () => true,
    });

    const output = warnSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(output).toContain('junk');
    expect(output).not.toContain('Model reasoning');
    warnSpy.mockRestore();
  });

  it('propagates transport errors without retrying', async () => {
    mockRequest.mockRejectedValueOnce(new Error('HTTP 429'));

    await expect(
      requestWithRetry({
        client: fakeClient,
        prompt: { system: 's', user: 'u' },
        isMalformed: () => true,
      })
    ).rejects.toThrow('HTTP 429');

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});

describe('requestBatchWithRetry', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('maps results to requestBatch shape and isolates failures', async () => {
    mockRequest
      .mockResolvedValueOnce(resp('good'))
      .mockRejectedValueOnce(new Error('boom'));

    const results = await requestBatchWithRetry({
      client: fakeClient,
      prompts: [{ system: 's', user: '1' }, { system: 's', user: '2' }],
      isMalformed: () => false,
    });

    expect(results).toEqual([
      { ok: true, data: 'good' },
      { ok: false, error: 'boom' },
    ]);
  });
});

describe('isUnparseableJSON', () => {
  it('flags empty/falsy output', () => {
    expect(isUnparseableJSON('')).toBe(true);
    expect(isUnparseableJSON(null)).toBe(true);
  });

  it('flags output with no extractable JSON', () => {
    expect(isUnparseableJSON('the model went haywire !@#$')).toBe(true);
  });

  it('flags malformed JSON inside a fence', () => {
    expect(isUnparseableJSON('```json\n{broken\n```')).toBe(true);
  });

  it('accepts valid fenced JSON', () => {
    expect(isUnparseableJSON('```json\n{"entries": []}\n```')).toBe(false);
  });

  it('accepts raw JSON objects and arrays', () => {
    expect(isUnparseableJSON('{"a": 1}')).toBe(false);
    expect(isUnparseableJSON('[1, 2]')).toBe(false);
  });
});

describe('isMalformedTranslation', () => {
  it('flags output without translation tags', () => {
    expect(isMalformedTranslation('no tags here at all')).toBe(true);
  });

  it('flags empty output', () => {
    expect(isMalformedTranslation('')).toBe(true);
  });

  it('accepts a translation tag with content', () => {
    expect(isMalformedTranslation('<translation>Hello</translation>')).toBe(false);
  });

  it('accepts recovered output with a missing closing tag', () => {
    expect(isMalformedTranslation('<translation>Hello world')).toBe(false);
  });
});

describe('isMalformedOperations', () => {
  it('flags output without operations tags', () => {
    expect(isMalformedOperations('garbage output')).toBe(true);
  });

  it('flags unparseable JSON inside the tag', () => {
    expect(isMalformedOperations('<operations>{broken</operations>')).toBe(true);
  });

  it('accepts valid JSON operations', () => {
    expect(isMalformedOperations('<operations>[{"action": "none"}]</operations>')).toBe(false);
  });
});
