/**
 * Parses JSON data from the output of an LLM (Large Language Model).
 * Tries fences first, then recovers balanced JSON segments from raw text.
 *
 * @param {string} llmOutput - The raw output string from the LLM.
 * @returns {object|Array|{}} - The parsed JSON value, or an empty object if it cannot be read.
 */
export function parseJSONFromLLM(llmOutput) {
  // Strategy 1: Look for ```json fence (expected format)
  let match = llmOutput.match(/```json\s*\n([\s\S]*?)\n?```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch {
      // Malformed, continue to other strategies
    }
  }

  // Strategy 2: Look for any code fence (``` with any or no language identifier)
  const fenceMatches = [...llmOutput.matchAll(/```\w*\s*\n([\s\S]*?)\n?(?:```|$)/g)];
  for (const fenceMatch of fenceMatches) {
    const content = fenceMatch[1].trim();
    // Try parsing as-is
    try {
      return JSON.parse(content);
    } catch {
      // Try removing JavaScript-style comments
      try {
        const cleaned = content
          .replace(/\/\/.*$/gm, '') // Remove line comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
        return JSON.parse(cleaned);
      } catch {
        // Try next fence
      }
    }
  }

  // Strategy 3: Extract all top-level balanced JSON segments from raw text
  const candidates = extractBalancedJSONSegments(llmOutput);

  // Prefer arrays first, then objects; within each type prefer the longer snippet
  const ordered = candidates
    .map(s => s.trim())
    .sort((a, b) => {
      const aIsArray = a.startsWith('[');
      const bIsArray = b.startsWith('[');
      if (aIsArray !== bIsArray) return aIsArray ? -1 : 1; // arrays first
      return b.length - a.length; // longer first
    });

  for (const snippet of ordered) {
    // Try parsing as-is
    try {
      return JSON.parse(snippet);
    } catch {
      // Try removing comments and re-parse
      try {
        const cleaned = snippet
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        return JSON.parse(cleaned);
      } catch {
        // keep trying next candidate
      }
    }
  }

  console.error(`No valid JSON found in LLM output. Raw response:\n\n${llmOutput}`);
  return {};
}

/**
 * Extract all top-level balanced JSON segments from text.
 * Handles strings and escapes, returns outermost {..} or [..] segments.
 *
 * @param {string} text
 * @returns {string[]} array of candidate JSON snippets
 */
function extractBalancedJSONSegments(text) {
  const candidates = [];
  let inString = false;
  let escapeNext = false;

  // Stack of opening brackets we have seen ('{' or '[')
  const stack = [];
  // Start index of current top-level segment (when stack goes from 0 -> 1)
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
      if (stack.length === 1) {
        segmentStart = i;
      }
      continue;
    }

    if (ch === '}' || ch === ']') {
      if (stack.length === 0) {
        // Unmatched closing bracket; ignore
        continue;
      }
      const open = stack[stack.length - 1];
      const matches = (open === '{' && ch === '}') || (open === '[' && ch === ']');
      if (!matches) {
        // Mismatched pair; reset the current tracking to avoid runaway
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
 * Extracts the content enclosed within a specified XML/HTML tag from a given string.
 * Considers success only when there are balanced tag pairs (either 1 or many).
 * Extra text outside or after the tags is ignored.
 * If tags are missing or unbalanced, it provides a fallback value ('###').
 *
 * @param {string} str - The input string containing the XML/HTML content.
 * @param {string} tag - The name of the tag to extract content from.
 * @returns {string} - The extracted content, or a fallback value ('###') if tags are missing or unbalanced.
 */
export function extractTextFromTag(str, tag) {
  // Escape special regex characters in tag
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Count opening and closing tags first
  const openingMatches = str.match(new RegExp(`<${escapedTag}>`, 'g'));
  const closingMatches = str.match(new RegExp(`</${escapedTag}>`, 'g'));
  const openingCount = openingMatches ? openingMatches.length : 0;
  const closingCount = closingMatches ? closingMatches.length : 0;

  // Balanced pairs: counts match and at least 1 pair exists
  if (openingCount > 0 && openingCount === closingCount) {
    const balancedRegex = new RegExp(`<${escapedTag}>(.*?)</${escapedTag}>`, 'gs');
    const matches = [...str.matchAll(balancedRegex)];
    if (matches.length > 0) {
      return matches.map(m => m[1].trim()).join('\n');
    }
  }

  // Tags missing or unbalanced
  if (openingCount === 0 && closingCount === 0) {
    console.warn(`Warning: No tags <${tag}> found.\n${str}`);
  } else {
    console.warn(`Warning: Unbalanced or malformed tags <${tag}>. Opening: ${openingCount}, Closing: ${closingCount}.\n${str}`);
  }

  return '###';
}