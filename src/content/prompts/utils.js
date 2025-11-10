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