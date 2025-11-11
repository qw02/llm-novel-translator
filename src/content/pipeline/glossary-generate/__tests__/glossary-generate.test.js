import { describe, it, expect } from 'vitest';
import { chunkTexts, validateGlossaryStructure } from "../glossary-generate.js";

describe('chunkTexts', () => {
  const mockTexts = [
    { id: '1', index: 0, text: 'First paragraph' },
    { id: '2', index: 1, text: 'Second paragraph' },
    { id: '3', index: 2, text: 'Third paragraph' },
  ];

  it('should chunk English texts by word count', () => {
    const maxChunkSize = 4; // 4 words max per chunk
    const result = chunkTexts(mockTexts, maxChunkSize, 'en');

    expect(result).toEqual([
      'First paragraph\nSecond paragraph',
      'Third paragraph'
    ]);
  });

  it('should chunk CJK texts by character count', () => {
    const cjkTexts = [
      { id: '1', index: 0, text: '日本語の文章' }, // 5 chars
      { id: '2', index: 1, text: '韓国語テキスト' }, // 6 chars
    ];

    const result = chunkTexts(cjkTexts, 6, 'ja');

    expect(result).toEqual([
      '日本語の文章',
      '韓国語テキスト'
    ]);
  });

  it('should handle empty texts array', () => {
    const result = chunkTexts([], 100, 'en');
    expect(result).toEqual([]);
  });

  it('should handle single paragraph within chunk size', () => {
    const singleText = [{ id: '1', index: 0, text: 'Single paragraph' }];
    const result = chunkTexts(singleText, 10, 'en');
    expect(result).toEqual(['Single paragraph']);
  });

  it('should split when paragraph exceeds chunk size alone', () => {
    const longText = [{ id: '1', index: 0, text: 'This is a very long paragraph that exceeds the limit' }];
    const result = chunkTexts(longText, 5, 'en');
    expect(result).toEqual(['This is a very long paragraph that exceeds the limit']);
  });
});

describe('validateGlossaryStructure', () => {
  it('should validate correct glossary structure', () => {
    const validGlossary = {
      entries: [
        {
          keys: ['artificial intelligence', 'AI'],
          value: '[noun] The simulation of human intelligence processes by machines'
        },
        {
          keys: ['machine learning'],
          value: '[noun] A subset of AI that enables computers to learn without explicit programming'
        }
      ]
    };

    expect(validateGlossaryStructure(validGlossary)).toBe(true);
  });

  it('should reject missing entries array', () => {
    expect(validateGlossaryStructure({})).toBe(false);
    expect(validateGlossaryStructure(null)).toBe(false);
    expect(validateGlossaryStructure(undefined)).toBe(false);
  });

  it('should reject invalid entry objects', () => {
    const invalidGlossary = {
      entries: [
        null,
        'not an object',
        { keys: ['valid'], value: '[noun] valid' }
      ]
    };

    expect(validateGlossaryStructure(invalidGlossary)).toBe(false);
  });

  it('should reject entries with empty keys array', () => {
    const invalidGlossary = {
      entries: [
        {
          keys: [],
          value: '[noun] Valid value but no keys'
        }
      ]
    };

    expect(validateGlossaryStructure(invalidGlossary)).toBe(false);
  });

  it('should reject non-string keys', () => {
    const invalidGlossary = {
      entries: [
        {
          keys: [123, 'valid'], // mixed types
          value: '[noun] Invalid because of number key'
        }
      ]
    };

    expect(validateGlossaryStructure(invalidGlossary)).toBe(false);
  });

  it('should reject duplicate keys', () => {
    const invalidGlossary = {
      entries: [
        {
          keys: ['AI', 'AI'], // duplicates
          value: '[noun] Duplicate keys should fail'
        }
      ]
    };

    expect(validateGlossaryStructure(invalidGlossary)).toBe(false);
  });

  it('should reject invalid value format', () => {
    const invalidGlossary = {
      entries: [
        {
          keys: ['test'],
          value: 'missing bracket prefix' // doesn't match pattern
        },
        {
          keys: ['test2'],
          value: '[noun]valid format' // missing space after bracket
        }
      ]
    };

    expect(validateGlossaryStructure(invalidGlossary)).toBe(false);
  });

  it('should accept various valid bracket formats', () => {
    const validGlossary = {
      entries: [
        {
          keys: ['test'],
          value: '[noun] regular format'
        },
        {
          keys: ['test2'],
          value: '[adj.] with punctuation'
        },
        {
          keys: ['test3'],
          value: '[v.t.] complex tag'
        }
      ]
    };

    expect(validateGlossaryStructure(validGlossary)).toBe(true);
  });
});