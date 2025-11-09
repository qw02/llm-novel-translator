/**
 * Dumb extractor for test page with known structure
 * For dev use
 */

export function extractText() {
  console.log('[Extractor] Starting extraction...');

  // Get all <p> elements with id starting with "p"
  const paragraphs = document.querySelectorAll('p[id^="p"]');

  const extracted = [];
  paragraphs.forEach((p, index) => {
    extracted.push({
      id: p.id,
      index: index,
      text: p.textContent.trim(),
      element: p, // Keep reference for later replacement
    });
  });

  console.log(`[Extractor] Extracted ${extracted.length} paragraphs`);
  return extracted;
}