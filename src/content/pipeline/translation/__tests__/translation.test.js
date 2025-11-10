// ./tests/translation.unit.test.js
import { describe, it, expect } from 'vitest';

import {
  computePrecedingText,
  filterRelevantGlossary,
  mapTranslationToTexts,
} from './../translation.js';

describe('computePrecedingText', () => {
  const texts = [
    { id: 'p1', index: 0, text: 'Line 0' },
    { id: 'p2', index: 1, text: 'Line 1' },
    { id: 'p3', index: 2, text: 'Line 2' },
    { id: 'p4', index: 3, text: 'Line 3' },
    { id: 'p5', index: 4, text: 'Line 4' },
  ];

  it('returns empty string when start is 0', () => {
    const config = { translation: { contextLines: 3 } };
    const result = computePrecedingText(texts, 0, config);
    expect(result).toBe('');
  });

  it('returns up to contextLines before start', () => {
    const config = { translation: { contextLines: 2 } };
    const result = computePrecedingText(texts, 3, config);
    // lines 1 and 2 before index 3
    expect(result).toBe('Line 1\nLine 2');
  });

  it('handles when fewer lines exist than contextLines', () => {
    const config = { translation: { contextLines: 10 } };
    const result = computePrecedingText(texts, 2, config);
    // Only lines 0 and 1 exist before 2
    expect(result).toBe('Line 0\nLine 1');
  });

  it('uses default contextLines=3 when missing', () => {
    const config = { translation: {} };
    const result = computePrecedingText(texts, 4, config);
    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  it('treats missing translation config as default contextLines=3', () => {
    const config = {};
    const result = computePrecedingText(texts, 3, config);
    expect(result).toBe('Line 0\nLine 1\nLine 2');
  });
});

describe('filterRelevantGlossary', () => {
  const glossary = {
    entries: [
      { keys: ['apple', 'red fruit'], value: 'apple: リンゴ' },
      { keys: ['banana'], value: 'banana: バナナ' },
      { keys: ['grape'], value: 'grape: ぶどう' },
    ],
  };

  it('returns empty array when glossary missing', () => {
    const result = filterRelevantGlossary(null, 'I like apples');
    expect(result).toEqual([]);
  });

  it('returns empty array when glossary.entries missing', () => {
    const result = filterRelevantGlossary({}, 'I like apples');
    expect(result).toEqual([]);
  });

  it('matches single key in context', () => {
    const result = filterRelevantGlossary(glossary, 'I ate a banana today');
    expect(result).toEqual(['banana: バナナ']);
  });

  it('matches multi-key entry when any key appears', () => {
    const result = filterRelevantGlossary(glossary, 'red fruit is tasty');
    expect(result).toEqual(['apple: リンゴ']);
  });

  it('matches multiple entries', () => {
    const context = 'banana and grape are in the basket';
    const result = filterRelevantGlossary(glossary, context);
    expect(result).toEqual(['banana: バナナ', 'grape: ぶどう']);
  });

  it('returns empty when no keys appear', () => {
    const result = filterRelevantGlossary(glossary, 'oranges everywhere');
    expect(result).toEqual([]);
  });
});

describe('mapTranslationToTexts', () => {
  function mkIntervalTexts(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      index: i,
      text: `Line ${i}`,
      translatedText: undefined,
    }));
  }

  it('maps 1-to-1 when counts match', () => {
    const arr = mkIntervalTexts(3);
    const translated = ['A', 'B', 'C'].join('\n');

    mapTranslationToTexts(arr, translated);

    expect(arr.map(x => x.translatedText)).toEqual(['A', 'B', 'C']);
  });

  it('when LLM returns more lines, extra lines combined into the last element', () => {
    const arr = mkIntervalTexts(3);
    const translated = ['A', 'B', 'C', 'D', 'E'].join('\n');

    mapTranslationToTexts(arr, translated);

    // First two mapped directly, remaining go to the last
    expect(arr[0].translatedText).toBe('A');
    expect(arr[1].translatedText).toBe('B');
    expect(arr[2].translatedText).toBe('C\nD\nE');
  });

  it('when LLM returns fewer lines, remaining elements become null', () => {
    const arr = mkIntervalTexts(4);
    const translated = ['A', 'B'].join('\n');

    mapTranslationToTexts(arr, translated);

    expect(arr.map(x => x.translatedText)).toEqual(['A', 'B', null, null]);
  });

  it('trims lines and filters out empty lines', () => {
    const arr = mkIntervalTexts(3);
    const translated = ['  A  ', '', '  ', 'B', 'C  '].join('\n');

    mapTranslationToTexts(arr, translated);

    // Empty lines removed, becomes ['A','B','C'] → 1:1 mapping
    expect(arr.map(x => x.translatedText)).toEqual(['A', 'B', 'C']);
  });

  it('handles single expected, multiple received -> all join into that single', () => {
    const arr = mkIntervalTexts(1);
    mapTranslationToTexts(arr, 'A\nB\nC');
    expect(arr[0].translatedText).toBe('A\nB\nC');
  });

  it('handles single expected, zero received -> null', () => {
    const arr = mkIntervalTexts(1);
    mapTranslationToTexts(arr, '');
    expect(arr[0].translatedText).toBe(null);
  });

  it('partial fill when fewer received than expected (integrity preservation)', () => {
    const arr = mkIntervalTexts(5);
    const translated = ['T0', 'T1', 'T2'].join('\n');

    mapTranslationToTexts(arr, translated);

    expect(arr.map(x => x.translatedText)).toEqual(['T0', 'T1', 'T2', null, null]);
  });

  it('distributes correctly when more received than expected by 1', () => {
    const arr = mkIntervalTexts(3);
    const translated = ['T0', 'T1', 'T2', 'T3'].join('\n');

    mapTranslationToTexts(arr, translated);

    expect(arr[0].translatedText).toBe('T0');
    expect(arr[1].translatedText).toBe('T1');
    expect(arr[2].translatedText).toBe('T2\nT3');
  });
});