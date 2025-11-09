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
 * If the closing tag is missing, it attempts to return the content after the opening tag.
 * If neither the opening nor closing tag is found, it provides a fallback value.
 *
 * @param {string} str - The input string containing the XML/HTML content.
 * @param {string} tag - The name of the tag to extract content from.
 * @returns {string} - The extracted content, or a fallback value ('###') if the tag is not found.
 */
export function extractTextFromTag(str, tag) {
  // Escape special regex characters in tag
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const openingTag = `<${tag}>`;
  const closingTag = `</${tag}>`;

  // Count opening and closing tags first
  const openingMatches = str.match(new RegExp(`<${escapedTag}>`, 'g'));
  const closingMatches = str.match(new RegExp(`</${escapedTag}>`, 'g'));
  const openingCount = openingMatches ? openingMatches.length : 0;
  const closingCount = closingMatches ? closingMatches.length : 0;

  // Fast path: counts match → return all balanced pairs
  if (openingCount > 0 && openingCount === closingCount) {
    const balancedRegex = new RegExp(`<${escapedTag}>(.*?)</${escapedTag}>`, 'gs');
    const matches = [...str.matchAll(balancedRegex)];
    if (matches.length > 0) {
      return matches.map(m => m[1].trim()).join('\n');
    }
  }

  // Helper to find all indices of a substring
  const findAllIndices = (text, substring) => {
    const indices = [];
    let index = 0;
    while ((index = text.indexOf(substring, index)) !== -1) {
      indices.push(index);
      index += substring.length;
    }
    return indices;
  };

  // Case 1: Missing first opening tag (one more closing than opening)
  if (closingCount === openingCount + 1 && closingCount > 0) {
    console.warn(`Warning: Missing first opening tag <${tag}>. Attempting recovery.\n${str}`);

    const openingIndices = findAllIndices(str, openingTag);
    const closingIndices = findAllIndices(str, closingTag);
    const extractedTexts = [];

    // First segment: from start to first closing tag
    extractedTexts.push(str.slice(0, closingIndices[0]).trim());

    // Remaining segments: balanced pairs
    for (let i = 0; i < openingIndices.length; i++) {
      const start = openingIndices[i] + openingTag.length;
      const end = closingIndices[i + 1];
      if (end !== undefined) {
        extractedTexts.push(str.slice(start, end).trim());
      }
    }

    return extractedTexts.join('\n');
  }

  // Case 2: Missing last closing tag (one more opening than closing)
  if (openingCount === closingCount + 1 && openingCount > 0) {
    console.warn(`Warning: Missing last closing tag </${tag}>. Attempting recovery.\n${str}`);

    const openingIndices = findAllIndices(str, openingTag);
    const closingIndices = findAllIndices(str, closingTag);
    const extractedTexts = [];

    // All but last: balanced pairs
    for (let i = 0; i < closingIndices.length; i++) {
      const start = openingIndices[i] + openingTag.length;
      const end = closingIndices[i];
      extractedTexts.push(str.slice(start, end).trim());
    }

    // Last segment: from last opening to end
    const lastStart = openingIndices[openingIndices.length - 1] + openingTag.length;
    extractedTexts.push(str.slice(lastStart).trim());

    return extractedTexts.join('\n');
  }

  // Case 3: No tags found or too broken
  if (openingCount === 0 && closingCount === 0) {
    console.warn(`Warning: No tags <${tag}> found.\n${str}`);
  } else {
    console.warn(`Warning: Tags too malformed to recover. Opening: ${openingCount}, Closing: ${closingCount}.\n${str}`);
  }

  return '###';
}