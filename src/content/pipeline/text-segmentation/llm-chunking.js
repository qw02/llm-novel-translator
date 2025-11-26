import { parseJSONFromLLM } from "../../utils/data-extraction.js";
import { LLMClient } from "../../llm-client.js";
import { getPromptBuilder } from "../../prompts/index.js";
import { mergeChunkIntervals } from "../../utils/merge-intervals.js";
import { getParagraphWeight } from "../../utils/text-helpers.js";

/**
 * Segments text using LLM-based chunking strategy.
 *
 * Flow:
 * 1. Create overlapping batches of paragraphs
 * 2. Generate prompts with offset mapping for each batch
 * 3. Send all requests to LLM concurrently
 * 4. Parse responses and unmap offsets to get actual paragraph indices
 * 5. Merge overlapping suggestions from batches
 * 6. Return final 0-indexed intervals
 *
 * @param {Object} config - Configuration object
 * @param {Array<{id: string, index: number, text: string}>} texts - Input paragraphs
 * @returns {Promise<Array<[number, number]>>} 0-indexed intervals [[start, end], ...]
 */
export async function segmentWithChunking(config, texts) {
  if (texts.length === 0) {
    return [];
  }

  const client = new LLMClient({
    llmId: config.llm.textChunking,
    stageId: "3",
    stageLabel: "Text Segmentation",
  });

  try {
    const promptBuilder = await getPromptBuilder(config.languagePair, 'text-segmentation');

    // Create batches with overlap and offset metadata
    const batches = createChunkingBatches(texts, config);

    const prompts = batches.map(batch =>
      promptBuilder.build(batch.paragraphs, batch.offset, config),
    );

    const results = await client.requestBatch(prompts);

    // Parse each response and unmap offsets to get actual paragraph indices
    const intervalLists = results.map((result, i) => {
      const batch = batches[i];

      // Parser handles offset unmapping and validation
      const intervals = getIntervalsFromLLMOrFallback(
        result.ok ? result.data : null,
        batch.actualStart,
        batch.actualEnd,
        {
          offset: batch.offset,
          fallbackSize: config.textSegmentation.fallbackSize ?? 5,
        },
      );

      return intervals;
    });

    // Merge overlapping suggestions from all batches
    // Input: Array of interval lists (1-indexed)
    // Output: Single merged list (1-indexed)
    const mergedIntervals = mergeChunkIntervals(intervalLists, {
      tolerance: 1,
    });


    // Convert from 1-indexed to 0-indexed for array access
    return mergedIntervals.map(interval => [interval[0] - 1, interval[1] - 1]);

  } finally {
    client.dispose();
  }
}

/**
 * Creates batches of paragraphs for LLM chunking requests.
 * Each batch stays under the configured character/word limit and includes overlap.
 *
 * @param {Array<{id: string, index: number, text: string}>} texts - Input paragraphs
 * @param {Object} config - Configuration object
 * @param {string} config.sourceLang - Source language code
 * @param {Object} config.textSegmentation - Segmentation settings
 * @param {number} config.textSegmentation.chunkSize - Maximum weight per batch
 * @param {number} [config.textSegmentation.overlapCount=10] - Paragraphs to overlap
 * @returns {Array<Object>} Batches with metadata
 */
export function createChunkingBatches(texts, config) {
  const batches = [];
  const chunkSize = config.textSegmentation.chunkSize;
  const overlapCount = config.textSegmentation.overlapCount ?? 10;
  const sourceLang = config.sourceLang;

  let currentStart = 0;

  while (currentStart < texts.length) {
    let currentWeight = 0;
    let endIndex = currentStart;

    // Greedily build a batch until we reach the weight limit
    for (let i = currentStart; i < texts.length; i++) {
      const paragraph = texts[i];
      const weight = getParagraphWeight(paragraph.text, sourceLang);

      // If adding this paragraph would exceed limit, stop
      // (but always include at least one paragraph)
      if (currentWeight > 0 && currentWeight + weight > chunkSize) {
        break;
      }

      currentWeight += weight;
      endIndex = i;
    }

    const paragraphs = texts.slice(currentStart, endIndex + 1);

    // Shift to 1-index for LLM input
    const actualStart = paragraphs[0].index + 1;
    const actualEnd = paragraphs[paragraphs.length - 1].index + 1;

    // Calculate offset to keep LLM-visible numbers in low range
    // If actualStart >= 20, map to start at 20; otherwise no offset
    const offset = actualStart >= 20 ? actualStart - 20 : 0;

    batches.push({
      paragraphs,
      offset,
      actualStart,
      actualEnd,
    });

    // If we've processed the last paragraph, we're done
    if (endIndex >= texts.length - 1) {
      break;
    }

    // Calculate the start of the next batch with overlap
    // Ensure we always move forward by at least one paragraph
    const nextStartIndex = endIndex - overlapCount + 1;
    currentStart = Math.max(currentStart + 1, nextStartIndex);
  }

  return batches;
}

/**
 * Generate a simple fallback: split [start, end] into chunks of size `step` (default 5).
 * Returns an array of [s, e] pairs, inclusive.
 */
export function makeFallbackIntervals(start, end, step = 5) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    throw new Error("Invalid start/end for fallback.");
  }
  const out = [];
  let s = start;
  while (s <= end) {
    const e = Math.min(s + step - 1, end);
    out.push([s, e]);
    s = e + 1;
  }
  return out;
}

/**
 * Validate the LLM segmentation for [start, end].
 * - Must be an array of [s, e] integer pairs.
 * - Must be sorted, contiguous, non-overlapping.
 * - Must exactly cover [start, end] without gaps.
 *
 * Returns the normalized intervals if valid; otherwise returns null.
 */
function validateIntervals(intervals, start, end) {
  if (!Array.isArray(intervals) || intervals.length === 0) return null;

  // Normalize and basic checks
  const norm = [];
  for (const item of intervals) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [s, e] = item;
    if (!Number.isInteger(s) || !Number.isInteger(e)) return null;
    if (s > e) return null;
    norm.push([s, e]);
  }

  // Sort by start, then end
  norm.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));

  // Check coverage and contiguity
  const first = norm[0];
  const last = norm[norm.length - 1];
  if (first[0] !== start) return null;
  if (last[1] !== end) return null;

  for (let i = 0; i < norm.length; i++) {
    const [s, e] = norm[i];
    // Must stay within [start, end]
    if (s < start || e > end) return null;

    // Contiguity: next.start === current.end + 1
    if (i > 0) {
      const prevE = norm[i - 1][1];
      if (s !== prevE + 1) return null;
    }
  }

  return norm;
}

/**
 * Parse, validate, or fallback to 5-paragraph chunks.
 *
 * @param {string} llmOutput - Raw output string from the LLM.
 * @param {number} start - Inclusive paragraph index for this window.
 * @param {number} end - Inclusive paragraph index for this window.
 * @param {object} [options]
 * @param {number} [options.fallbackSize=5] - Paragraphs per fallback chunk.
 * @returns {Array<[number, number]>} - Valid intervals covering [start, end].
 */
export function getIntervalsFromLLMOrFallback(llmOutput, start, end, options = {}) {
  const { fallbackSize = 5 } = options;

  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) {
    throw new Error("Invalid start/end bounds.");
  }

  let parsed;
  try {
    parsed = parseJSONFromLLM(llmOutput);
  } catch {
    parsed = {};
  }

  const valid = validateIntervals(parsed, start, end);
  if (valid) return valid;

  // Fallback
  return makeFallbackIntervals(start, end, fallbackSize);
}
