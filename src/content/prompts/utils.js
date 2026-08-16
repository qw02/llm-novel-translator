/**
 * Default target chunk size used when the user has not chosen one
 * (e.g., config from an older version) or the stored key no longer exists.
 */
export const DEFAULT_TARGET_SIZE = 'medium';

/**
 * Resolve a chunk-size preset from a per-pair `chunkSizeOptions` object.
 * Fallback order: requested key → DEFAULT_TARGET_SIZE → first available key.
 *
 * @param {Object} chunkSizeOptions - Map of size key (e.g. 'small') to preset params.
 * @param {string} [requestedKey] - Size key from config.textSegmentation.targetSize.
 * @returns {{key: string, preset: Object}} The effective size key and its preset params.
 */
export function resolveChunkSizePreset(chunkSizeOptions, requestedKey) {
  const keys = Object.keys(chunkSizeOptions || {});
  if (keys.length === 0) {
    throw new Error('[Prompts] chunkSizeOptions must define at least one size preset.');
  }

  const key = Object.prototype.hasOwnProperty.call(chunkSizeOptions, requestedKey)
    ? requestedKey
    : (Object.prototype.hasOwnProperty.call(chunkSizeOptions, DEFAULT_TARGET_SIZE)
      ? DEFAULT_TARGET_SIZE
      : keys[0]);

  return { key, preset: chunkSizeOptions[key] };
}

/**
 * Formatting helper for the chunk text prompt builders
 * @param {Array<{text: string, index: number}>} indexedParagraphs - The paragraphs for this batch.
 * @param offset - The offset to subtract for mapping indices to lower range.
 * @returns {{start: number|number, end: number|number, text: string}}
 */
export function getChunkingUserParts(indexedParagraphs, offset) {
  const textBlock = indexedParagraphs
    .map(p => `[${p.index + 1 - offset}] ${p.text}`)
    .join('\n');
  const startIndex = indexedParagraphs[0]?.index + 1 - offset || 1;
  const endIndex = indexedParagraphs[indexedParagraphs.length - 1]?.index + 1 - offset || 1;

  return { start: startIndex, end: endIndex, text: textBlock };
}