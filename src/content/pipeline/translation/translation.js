/**
 * Stage 4: Translate text chunks
 */
import { getPromptBuilder } from "../../prompts/index.js";
import { LLMClient } from "../../llm-client.js";
import { extractTextFromTag } from "../../utils/data-extraction.js";

/**
 * Translates text based on provided intervals.
 *
 * Flow:
 * 1. Build prompts for each interval with context and relevant glossary
 * 2. Send all requests concurrently
 * 3. Map responses back to text objects, handling line count mismatches
 * 4. Return augmented texts with translatedText field
 *
 * @param {Object} config - Configuration object
 * @param {Array<{id: string, index: number, text: string}>} texts - Input texts
 * @param {Object} glossary - Glossary with entries array
 * @param {Array<[number, number]>} intervals - 0-indexed intervals [[start, end], ...]
 * @returns {Promise<{translatedTexts: Array<{id: string, index: number, text: string}>, translationMetadata: *[]}>} Texts with translatedText and metadata
 */
export async function translateText(config, texts, glossary, intervals) {
  // Initialize all translatedText fields to undefined
  for (const text of texts) {
    text.translatedText = undefined;
  }

  if (texts.length === 0 || intervals.length === 0) {
    console.warn('[Translation] Translation pipeline called with missing text or intervals!');
    return { translatedTexts: texts, translationMetadata: [] };
  }

  const client = new LLMClient({
    llmId: config.llm.translation,
    stageId: "4",
    stageLabel: "Translation",
  });

  try {
    const promptBuilder = await getPromptBuilder(config.languagePair, 'translate');

    // Build prompts for all intervals
    const promptData = intervals.map(([start, end]) => {
      const intervalTexts = texts.slice(start, end + 1);
      const precedingText = computePrecedingText(texts, start, config);
      const sourceText = intervalTexts.map(t => t.text).join('\n');

      const fullContextText = precedingText + '\n' + sourceText;
      const relevantEntries = filterRelevantGlossary(glossary, fullContextText);

      const prompt = promptBuilder.build(
        sourceText,
        {
          precedingText,
          relevantEntries,
          customInstruction: config.customInstruction,
        },
        config,
      );

      return {
        interval: [start, end],
        precedingText,
        sourceText,
        relevantEntries,
        prompt,
      };
    });

    const prompts = promptData.map(m => m.prompt);

    // Send to LLM
    const results = await client.requestBatch(prompts);

    // Store data for post-editing
    const intervalMetadata = [];

    // Map translations back to text objects
    for (let i = 0; i < results.length; i++) {
      const { interval, precedingText, sourceText, relevantEntries } = promptData[i];
      const [start, end] = interval;
      const result = results[i];
      const intervalTexts = texts.slice(start, end + 1);

      let translatedText = '';
      let success = false;

      if (result.ok) {
        // Extract and map successful translation
        translatedText = extractTextFromTag(result.data, 'translation');

        if (translatedText.length > 0) {
          mapTranslationToTexts(intervalTexts, translatedText);
          success = true;
        } else {
          // Empty translation: mark as failed
          console.warn(`Empty translation for interval [${start}, ${end}]`);
          for (const text of intervalTexts) {
            text.translatedText = null;
            text.translationError = 'Empty translation received';
          }
        }
      } else {
        // Mark all texts in this interval as failed
        console.error(`Translation failed for interval [${start}, ${end}]:`, result.error);
        for (const text of intervalTexts) {
          text.translatedText = null;
          text.translationError = result.error;
        }
      }

      intervalMetadata.push({
        interval: [start, end],
        precedingText,
        sourceText,
        translatedText,
        relevantEntries,
        success,
      });
    }

    return {
      translatedTexts: texts,
      translationMetadata: intervalMetadata,
    };

  } finally {
    client.dispose();
  }
}

/**
 * Computes preceding text for context.
 *
 * @param {Array} texts - All text objects
 * @param {number} start - Start index of current interval
 * @param {Object} config - Configuration object
 * @returns {string} Preceding text joined by newlines
 */
export function computePrecedingText(texts, start, config) {
  const contextLines = config.translation?.contextLines ?? 3;
  const precedingStart = Math.max(0, start - contextLines);

  return texts
    .slice(precedingStart, start)
    .map(t => t.text)
    .join('\n');
}

/**
 * Filters glossary entries relevant to the current context.
 *
 * @param {Object} glossary - Glossary object with entries array
 * @param {string} fullContextText - Combined preceding + source text
 * @returns {Array<string>} Array of relevant glossary values
 */
export function filterRelevantGlossary(glossary, fullContextText) {
  if (!glossary || !glossary.entries) {
    return [];
  }

  const relevantEntries = [];
  for (const entry of glossary.entries) {
    if (entry.keys.some(key => fullContextText.includes(key))) {
      relevantEntries.push(entry.value);
    }
  }

  return relevantEntries;
}

/**
 * Maps translated lines back to the interval's text objects.
 * Handles line count mismatches by distributing or combining lines appropriately.
 *
 * @param {Array} intervalTexts - Text objects for this interval
 * @param {string} translatedText - Newline-separated translated text from LLM
 */
export function mapTranslationToTexts(intervalTexts, translatedText) {
  // Split and clean translated lines
  const translatedLines = translatedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const numExpected = intervalTexts.length;
  const numReceived = translatedLines.length;

  if (numReceived === numExpected) {
    // Perfect match: 1-to-1 mapping
    for (let i = 0; i < numExpected; i++) {
      intervalTexts[i].translatedText = translatedLines[i];
    }

  } else if (numReceived > numExpected) {
    // More lines received: distribute normally, combine extra into last paragraph
    for (let i = 0; i < numExpected - 1; i++) {
      intervalTexts[i].translatedText = translatedLines[i];
    }

    // Combine all remaining lines into the last paragraph
    const extraLines = translatedLines.slice(numExpected - 1);
    intervalTexts[numExpected - 1].translatedText = extraLines.join('\n');

  } else {
    // Fewer lines received: distribute what we have, mark rest as null
    for (let i = 0; i < numReceived; i++) {
      intervalTexts[i].translatedText = translatedLines[i];
    }

    // Mark remaining paragraphs as null (renderer / replacer handles these)
    for (let i = numReceived; i < numExpected; i++) {
      intervalTexts[i].translatedText = null;
    }
  }
}
