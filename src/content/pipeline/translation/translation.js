/**
 * Stage 4: Translate text chunks
 */

export async function translateText(client, textSegments, intervals) {
  console.log(`[Translation] Translating ${intervals.length} chunks`);

  // Build user prompts for each chunk
  const prompts = intervals.map(([start, end]) => {
    const chunkText = textSegments
      .slice(start, end + 1)
      .map(s => s.text)
      .join('\n');

    return `Translate:\n${chunkText}`;
  });

  // Send batch request
  const results = await client.requestBatch(prompts);

  // Extract translations
  const translations = results.map(r => {
    if (!r.ok) {
      console.error('[Translation] Chunk failed:', r.error);
      return '[Translation Error]';
    }
    return r.data;
  });

  // Expand chunks back to individual segments
  const expandedTranslations = [];
  for (let i = 0; i < intervals.length; i++) {
    const [start, end] = intervals[i];
    const chunkTranslation = translations[i];

    // Split translation back into lines (simple split for now)
    const lines = chunkTranslation.split('\n');

    for (let j = start; j <= end; j++) {
      expandedTranslations.push(lines[j - start] || chunkTranslation);
    }
  }

  console.log(`[Translation] Translated ${expandedTranslations.length} segments`);
  return expandedTranslations;
}