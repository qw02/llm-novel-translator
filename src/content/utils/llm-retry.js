/**
 * Retry logic for malformed LLM outputs.
 *
 * Distinct from transport-level retries (HTTP 429, dead worker, etc.) handled
 * in llm-client.js. This layer re-sends the exact same request when the model
 * returns structurally broken content (unparseable JSON, missing XML tags).
 *
 * Two-tier strategy, 3 attempts total (hard-coded):
 * - Attempts 1-2: identical request against the primary model.
 * - Attempt 3: identical request against the fallback model
 *   (config.llm.fallback), on the assumption the payload is glitching the
 *   primary model. If no fallback is configured, the primary is reused.
 */

import { LLMClient } from '../llm-client.js';
import { extractTextFromTag } from './data-extraction.js';

const MAX_ATTEMPTS = 3;
const FALLBACK_ATTEMPT = 3;

/**
 * Logs the malformed response body (and the model's reasoning trace, when
 * present) so callers can inspect exactly what the model produced.
 *
 * @param {string} raw - The assistant response text
 * @param {string|null} reasoning - The model's reasoning trace, if any
 */
function logMalformedResponse(raw, reasoning) {
  const sections = [`[LLMRetry] Malformed response body:\n${raw}`];
  if (reasoning) {
    sections.push(`[LLMRetry] Model reasoning:\n${reasoning}`);
  }
  console.warn(sections.join('\n'));
}

/**
 * Sends a prompt with malformed-output retries.
 *
 * @param {Object} params
 * @param {LLMClient} params.client - Primary client (used for progress tracking)
 * @param {string|null} params.fallbackLlmId - Fallback model id, or null
 * @param {string} params.stageId - Stage id for the fallback client
 * @param {string} params.stageLabel - Stage label for the fallback client
 * @param {Object} params.customParams - Custom params for the fallback client
 * @param {{system: string, user: string}} params.prompt
 * @param {(raw: string) => boolean} params.isMalformed
 * @returns {Promise<{raw: string, attempts: number, usedFallback: boolean, malformed: boolean}>}
 */
export async function requestWithRetry({
  client,
  fallbackLlmId = null,
  stageId,
  stageLabel,
  customParams = {},
  prompt,
  isMalformed,
}) {
  let lastRaw = null;
  let fallbackClient = null;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const useFallback = attempt === FALLBACK_ATTEMPT && !!fallbackLlmId;

      let clientForAttempt;
      if (useFallback) {
        if (!fallbackClient) {
          fallbackClient = new LLMClient({
            llmId: fallbackLlmId,
            stageId,
            stageLabel: `${stageLabel} (fallback)`,
            customParams,
          });
        }
        console.warn(`[LLMRetry] Retrying with fallback model '${fallbackLlmId}' (attempt ${attempt}/${MAX_ATTEMPTS}).`);
        clientForAttempt = fallbackClient;
      } else {
        if (attempt > 1) {
          console.warn(`[LLMRetry] Malformed output, retrying same request (attempt ${attempt}/${MAX_ATTEMPTS}).`);
        }
        clientForAttempt = client;
      }

      // LLMClient.request resolves with { assistant, reasoning }; reasoning is
      // null for models that don't expose a reasoning trace.
      const response = await clientForAttempt.request(prompt);
      const raw = response.assistant;
      const reasoning = response.reasoning ?? null;

      lastRaw = raw;

      if (!isMalformed(raw)) {
        return { raw, attempts: attempt, usedFallback: useFallback, malformed: false };
      }

      logMalformedResponse(raw, reasoning);
      console.warn(`[LLMRetry] Attempt ${attempt}/${MAX_ATTEMPTS} returned malformed output.`);
    }

    // All attempts exhausted; return the last raw response so callers can
    // apply their existing degraded behavior (fallback intervals, nulls, etc.)
    return {
      raw: lastRaw,
      attempts: MAX_ATTEMPTS,
      usedFallback: !!fallbackLlmId,
      malformed: true,
    };
  } finally {
    if (fallbackClient) {
      fallbackClient.dispose();
    }
  }
}

/**
 * Batch variant: runs requestWithRetry for every prompt concurrently.
 * Mirrors LLMClient.requestBatch's result shape.
 *
 * @param {Object} params - Same as requestWithRetry, minus prompt/isMalformed
 * @param {Array<{system: string, user: string}>} params.prompts
 * @param {(raw: string) => boolean} params.isMalformed
 * @returns {Promise<Array<{ok: boolean, data?: string, error?: string}>>}
 */
export async function requestBatchWithRetry(params) {
  const { prompts, ...rest } = params;

  const promises = prompts.map(async (prompt) => {
    try {
      const { raw } = await requestWithRetry({ ...rest, prompt });
      return { ok: true, data: raw };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  return Promise.all(promises);
}

/**
 * True when no usable JSON could be extracted from the response.
 * Mirrors the strategies in parseJSONFromLLM (fences, then balanced segments)
 * without calling it, so tests mocking the parser are unaffected.
 */
export function isUnparseableJSON(raw) {
  if (!raw) return true;

  // Strategy 1/2: any code fence whose content parses as JSON
  const fenceMatches = [...raw.matchAll(/```\w*\s*\n([\s\S]*?)\n?(?:```|$)/g)];
  for (const fenceMatch of fenceMatches) {
    if (canParseAsJSON(fenceMatch[1].trim())) return false;
  }

  // Strategy 3: any balanced top-level {...} or [...] segment that parses
  for (const segment of extractBalancedSegments(raw)) {
    if (canParseAsJSON(segment.trim())) return false;
  }

  return true;
}

function canParseAsJSON(text) {
  if (!text) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    try {
      const cleaned = text
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      JSON.parse(cleaned);
      return true;
    } catch {
      return false;
    }
  }
}

function extractBalancedSegments(text) {
  const candidates = [];
  let inString = false;
  let escapeNext = false;
  const stack = [];
  let segmentStart = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{' || ch === '[') {
      stack.push(ch);
      if (stack.length === 1) segmentStart = i;
      continue;
    }

    if (ch === '}' || ch === ']') {
      if (stack.length === 0) continue;
      const open = stack[stack.length - 1];
      const matches = (open === '{' && ch === '}') || (open === '[' && ch === ']');
      if (!matches) {
        stack.length = 0;
        segmentStart = -1;
        continue;
      }
      stack.pop();
      if (stack.length === 0 && segmentStart !== -1) {
        candidates.push(text.slice(segmentStart, i + 1));
        segmentStart = -1;
      }
    }
  }

  return candidates;
}

/**
 * True when the response has no usable <translation> tag content.
 * extractTextFromTag returns '###' when tags are absent or too broken.
 */
export function isMalformedTranslation(raw) {
  if (!raw) return true;
  const text = extractTextFromTag(raw, 'translation');
  return text === '###' || text.trim().length === 0;
}

/**
 * True when the response has no <operations> tag or its JSON is unparseable.
 * (Invalid action shapes inside valid JSON are NOT malformed; they keep their
 * existing degraded no-op behavior.)
 */
export function isMalformedOperations(raw) {
  if (!raw) return true;
  const json = extractTextFromTag(raw, 'operations');
  if (json === '###' || !json) return true;
  try {
    JSON.parse(json);
    return false;
  } catch {
    return true;
  }
}
