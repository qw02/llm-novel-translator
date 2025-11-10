/**
 * Stage 1: Extract terminology from source text
 */

import { getPromptBuilder } from '../../prompts/index.js';
import { LLMClient } from "../../llm-client.js";
import { parseJSONFromLLM } from "../../utils/data-extraction.js"
import { getParagraphWeight } from "../../utils/text-helpers.js";

// Default chunk size for glossary generation
const GLOSSARY_CHUNK_SIZE = 4000;

/**
 * Generate glossary entries from text segments
 */
export async function generateGlossary(config, textSegments) {
  const client = new LLMClient({
    llmId: config.llm.glossaryGenerate,
    stageId: "1",
    stageLabel: "Glossary Generation",
  });

  try {
    // Chunk texts into manageable blocks
    const chunkSize = config.glossaryChunkSize || GLOSSARY_CHUNK_SIZE;
    const sourceLang = config.sourceLang;

    const chunks = chunkTexts(textSegments, chunkSize, sourceLang);

    // Get prompt builder
    const promptBuilder = await getPromptBuilder(config.languagePair, 'glossary-generate');

    // Create prompts for each chunk
    const prompts = chunks.map(chunk => promptBuilder.build(chunk));

    // Run inference in parallel
    const results = await client.requestBatch(prompts);

    // Consolidate responses
    const allEntries = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (!result.ok) {
        failCount++;
        console.warn(`[GlossaryGen] Chunk ${i + 1}/${results.length} request failed:`, result.error);
        continue;
      }

      try {
        const parsed = parseJSONFromLLM(result.data);

        // Check if parsing returned empty object (malformed response)
        if (!parsed || Object.keys(parsed).length === 0) {
          failCount++;
          console.warn(`[GlossaryGen] Chunk ${i + 1}/${results.length} returned malformed or empty JSON`);
          continue;
        }

        if (validateStage1Response(parsed)) {
          allEntries.push(...parsed.entries);
          successCount++;
        } else {
          failCount++;
          console.warn(`[GlossaryGen] Chunk ${i + 1}/${results.length} returned invalid response structure`);
        }
      } catch (err) {
        failCount++;
        console.warn(`[GlossaryGen] Failed to process chunk ${i + 1}/${results.length}:`, err.message);
      }
    }

    return allEntries;

  } finally {
    // Always dispose client when done
    client.dispose();
  }
}

/**
 * Chunk texts into blocks to fit in LLM context window
 */
function chunkTexts(texts, maxChunkSize, lang) {
  const chunks = [];
  let currentChunk = '';
  let currentWeight = 0;

  for (const segment of texts) {
    const text = segment.text;
    const textWeight = getParagraphWeight(text, lang);

    // If adding this paragraph would exceed the maximum chunk size, start a new chunk
    if (currentWeight + textWeight > maxChunkSize && currentWeight > 0) {
      chunks.push(currentChunk);
      currentChunk = text;
      currentWeight = textWeight;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + text;
      currentWeight += textWeight;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Validate structure of generated glossary
 */
function validateStage1Response(obj) {
  if (!obj || !Array.isArray(obj.entries)) {
    return false;
  }

  const valuePattern = /^\[.*] .*$/;

  return obj.entries.every(entry => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const { keys, value } = entry;

    if (!Array.isArray(keys) || keys.length === 0) {
      return false;
    }

    const allKeysAreStrings = keys.every(key => typeof key === 'string');
    const allKeysAreUnique = new Set(keys).size === keys.length;

    if (!allKeysAreStrings || !allKeysAreUnique) {
      return false;
    }

    if (typeof value !== 'string' || !valuePattern.test(value)) {
      return false;
    }

    return true;
  });
}