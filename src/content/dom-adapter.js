import { getActiveAdapter } from '../domains/registry.js';

/** @type {import('../domains/types.js').DomainAdapter | null} */
let activeAdapter = null;

const ensureAdapter = () => {
  if (!activeAdapter) {
    activeAdapter = getActiveAdapter(window.location.href);
  }
  return activeAdapter;
};

export const getDomainId = () => {
  return ensureAdapter().getId();
};

export const getSeriesId = () => {
  return ensureAdapter().getSeriesId();
};

/**
 * Used by pipeline or preview to get the text content from the DOM
 *   const paragraphs = extractText();
 *
 * @returns {import('../domains/types.js').ParagraphData[]}
 */
export const extractText = () => {
  return ensureAdapter().extractText();
};

/**
 * Writes the translation back to the DOM
 *   replaceText(translatedParagraphs, options);
 *
 * @param {import('../domains/types.js').TranslatedParagraph[]} items
 * @param {import('../domains/types.js').ReplaceOptions} [options]
 */
export const replaceText = (items, options) => {
  return ensureAdapter().replaceText(items, options);
};

/**
 * Builds the storage keys for glossaries, based on the currently active adapter.
 *
 * @param {string} sourceLang e.g. "ja"
 * @param {string} targetLang e.g. "en"
 */
export const buildGlossaryKeys = (sourceLang, targetLang) => {
  const adapter = ensureAdapter();
  const domainId = adapter.getId();
  const seriesId = adapter.getSeriesId();
  const languagePair = `${sourceLang}_${targetLang}`;

  const globalKey = `glossary_global_${languagePair}`;
  const seriesKey = `glossary_${domainId}_${seriesId}_${languagePair}`;

  return { globalKey, seriesKey };
};
