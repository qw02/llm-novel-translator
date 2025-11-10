import { parseJSONFromLLM } from "../../utils/data-extraction.js";

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