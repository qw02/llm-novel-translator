import { describe, expect, it } from "vitest";
import { getParagraphWeight } from "../text-helpers.js";

describe('getParagraphWeight', () => {
  it('should count words for English text', () => {
    expect(getParagraphWeight('Hello world', 'en')).toBe(2);
    expect(getParagraphWeight('  Multiple   spaces  ', 'en')).toBe(2);
  });

  it('should count characters for Japanese text', () => {
    expect(getParagraphWeight('日本語', 'ja')).toBe(3);
    expect(getParagraphWeight('韓国語', 'ko')).toBe(3);
  });

  it('should handle empty text', () => {
    expect(getParagraphWeight('', 'en')).toBe(0);
    expect(getParagraphWeight('', 'ja')).toBe(0);
  });

  it('should handle various CJK language codes', () => {
    const cjkText = '中文测试';
    expect(getParagraphWeight(cjkText, 'zh')).toBe(4);
    expect(getParagraphWeight(cjkText, 'zh-CN')).toBe(4);
    expect(getParagraphWeight(cjkText, 'zh-TW')).toBe(4);
  });
});