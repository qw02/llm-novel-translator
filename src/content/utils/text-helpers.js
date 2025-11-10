/**
 * Computes the weight (character or word count) of a paragraph based on language.
 * Determines how paragraphs are batched to stay under the chunk size limit.
 *
 * @param {string} text - The paragraph text
 * @param {string} lang - BCP-47 Language code (e.g., 'ja', 'en', 'zh-Hans')
 * @returns {number} Weight of the paragraph
 */
export function getParagraphWeight(text, lang) {
  const cjkLanguages = ['ja', 'zh', 'zh-CN', 'zh-TW', 'ko'];

  if (cjkLanguages.includes(lang)) {
    // For CJK: count individual characters
    return text.length;
  }

  // For other languages: count words (split by whitespace)
  return text.split(/\s+/).filter(word => word.length > 0).length;
}