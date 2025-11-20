import { franc } from 'franc';

/**
 * Maps franc ISO 639-3 codes to the BCP-47 codes used in this extension.
 * Note: 'cmn' (Mandarin) is mapped to a base 'zh' to handle the
 * ambiguity between Simplified and Traditional scripts in detection.
 */
const ISO_TO_APP_LANG = {
  'eng': 'en',
  'spa': 'es',
  'fra': 'fr',
  'cmn': 'zh',
  'jpn': 'ja',
  'kor': 'ko',
  'deu': 'de',
  'rus': 'ru',
  'ita': 'it',
  'por': 'pt',
};

export class LanguageDetector {
  constructor() {
    this.sampleLimit = 200;
    this.minLengthThreshold = 5; // Ignore very short utterances (e.g., "Oh!", "...")
  }

  /**
   * Normalizes extension BCP-47 codes to a base format for comparison.
   * e.g., 'zh-Hans' -> 'zh', 'en' -> 'en'.
   */
  _normalizeCode(code) {
    if (code.startsWith('zh')) return 'zh';
    return code;
  }

  /**
   * Analyzes the provided text objects to determine the dominant language.
   *
   * @param {Array<{text: string}>} texts - The input text array.
   * @param {string} configLang - The expected source language from config (BCP-47).
   * @returns {Object} Result containing the detected language, confidence scores, and match status.
   */
  analyze(texts, configLang) {
    if (!texts || texts.length === 0) {
      return { error: 'EMPTY_INPUT' };
    }

    const sample = texts.slice(0, this.sampleLimit);
    const stats = new Map();
    let validSamples = 0;

    for (const item of sample) {
      // Skip empty or extremely short lines which produce noise in franc
      if (!item.text || item.text.length < this.minLengthThreshold) continue;

      // franc returns 'und' if undetermined, or a 3-letter code
      const detectedIso = franc(item.text);

      if (detectedIso === 'und') continue;

      const mappedLang = ISO_TO_APP_LANG[detectedIso] || 'unknown';

      stats.set(mappedLang, (stats.get(mappedLang) || 0) + 1);
      validSamples++;
    }

    if (validSamples === 0) {
      return { error: 'INSUFFICIENT_DATA', detected: null, confidence: 0 };
    }

    // Determine the most frequent language found
    let dominantLang = null;
    let maxCount = 0;

    for (const [lang, count] of stats.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantLang = lang;
      }
    }

    const normalizedConfig = this._normalizeCode(configLang);
    const confidence = maxCount / validSamples;

    // Check if the detected dominant language matches the config
    // We compare normalized versions to handle the zh-Hans/cmn case
    const isMatch = dominantLang === normalizedConfig;

    return {
      detectedRaw: dominantLang, // The code we found (e.g., 'en', 'zh', 'ja')
      expectedRaw: configLang,   // The code from config
      confidence: confidence,    // Float 0.0 - 1.0
      isMatch: isMatch,          // Boolean
      sampleSize: validSamples
    };
  }
}

/**
 * Convenience wrapper to analyze language consistency against a configuration.
 * Used by validation logic.
 *
 * @param {Array} texts - The text content array.
 * @param {Object} config - The configuration object containing sourceLang.
 * @returns {Object} Analysis result.
 */
export const getLanguage = (texts, config) => {
  const detector = new LanguageDetector();
  return detector.analyze(texts, config.sourceLang);
};
