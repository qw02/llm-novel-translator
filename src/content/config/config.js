/**
 * Configuration loading, aggregation and validation
 */
import { LANGS } from "../../common/languages.js";
import { getLanguage } from "../languages/detect-language.js";

class TranslationConfig {
  constructor(raw) {
    Object.assign(this, raw);
  }

  get languagePair() {
    return `${this.sourceLang}_${this.targetLang}`;
  }

  get sourceLangName() {
    return getName(this.sourceLang);
  }

  get targetLangName() {
    return getName(this.targetLang);
  }
}

export async function getTranslationConfig(popupOverrides) {
  // Load from disk
  const { translation_config } = await chrome.storage.local.get('translation_config');

  // Fully materialize and copy before mutation
  const rawConfig = structuredClone(translation_config)

  // Only used by UI
  delete rawConfig.mode;
  delete rawConfig.showAllModels;

  // Add getters
  const config = new TranslationConfig(rawConfig);

  console.log(popupOverrides);

  // Add overrides from popup UI
  if (popupOverrides.skipGlossary && config.updateGlossary) {
    config.updateGlossary = false;
  }


  if (popupOverrides.popupSourceLang) {
    config.sourceLang = popupOverrides.popupSourceLang;
  }

  if (popupOverrides.popupTargetLang) {
    config.targetLang = popupOverrides.popupTargetLang;
  }

  return config;
}

/**
 * Validates the configuration and input text before starting the pipeline.
 * Returns hard errors for critical failures, and warnings for potential issues
 * (like language mismatch) that the user can choose to override.
 *
 * @param {Object} config - The user configuration.
 * @param {Array} text - The extracted text array.
 * @returns {Promise<{ok: boolean, error?: string, warning?: string}>}
 */
export async function validateConfig(config, text) {
  console.log('Starting validation...');
  let warnings = [];

  // --- 1. Hard Validation (Blocking Errors) ---

  // Basic Logic Check
  if (config.sourceLang === config.targetLang) {
    return { ok: false, error: "Source and Target languages cannot be the same." };
  }

  // Supported Language Check
  // We must ensure the source lang is actually in our supported dictionary
  if (!LANGS[config.sourceLang]) {
    return { ok: false, error: `Source language code '${config.sourceLang}' is not supported.` };
  }

  // Content Existence Check
  if (!Array.isArray(text) || text.length === 0) {
    return { ok: false, error: "No text content was found on the page to translate." };
  }

  // --- 2. Soft Validation (Warnings) ---

  // Perform statistical language detection
  // This uses the class we wrote in ./src/content/languages/language-detect.js
  const langAnalysis = getLanguage(text, config);

  if (langAnalysis.error) {
    // If data was insufficient (e.g. only numbers or symbols), we warn but allow proceed.
    warnings.push("Could not reliably detect the source language from the content.");
  } else {
    const CONFIDENCE_THRESHOLD = 0.9; // 90% requirement

    // Case A: Major Mismatch
    // The dominant language found by franc does not align with config.sourceLang
    if (!langAnalysis.isMatch) {
      // Try to get a readable name for the detected code, falling back to the code itself
      const detectedName = LANGS[langAnalysis.detectedRaw] || `Unknown (${langAnalysis.detectedRaw})`;
      const expectedName = LANGS[config.sourceLang];

      warnings.push(
        `Language Mismatch: The content appears to be predominantly ${detectedName}, ` +
        `but your configuration is set to ${expectedName}.`,
      );
    }

      // Case B: Match, but Low Confidence
    // The language matches, but there is significant noise (mixed languages, code snippets, etc.)
    else if (langAnalysis.confidence < CONFIDENCE_THRESHOLD) {
      const percentage = Math.floor(langAnalysis.confidence * 100);
      warnings.push(
        `Low Confidence: Only ${percentage}% of the analyzed text clearly matches the source language. ` +
        `The extracted content might contain mixed languages or noise.`,
      );
    }
  }

  // --- 3. Final Return ---

  if (warnings.length > 0) {
    return { ok: true, warning: warnings.join('\n') };
  }

  return { ok: true };
}

function getName(code) {
  return LANGS[code] || code;
}
