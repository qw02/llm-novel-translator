/**
 * Stage 5: Polish and QC translations
 */
import { LLMClient } from "../../llm-client.js";
import { getPromptBuilder } from "../../prompts/index.js";
import { PostEditProcessor } from "./edit-processor.js";

/**
 * Post-edits translations based on metadata from translation stage.
 *
 * Flow:
 * 1. Filter successful translations from metadata
 * 2. Build post-edit prompts for each interval
 * 3. Send all requests concurrently
 * 4. Parse JSON operation responses
 * 5. Apply validated operations to translated text
 * 6. Map edited text back to translatedTexts array
 * 7. Store pre-QC versions for debugging
 *
 * @param {Object} config - Configuration object
 * @param {Array} translatedTexts - Texts with translatedText field from translation stage
 * @param {Array} translationMetadata - Metadata from translation stage
 * @returns {Promise<Array>} Texts with post-edited translations and debugging info
 */
export async function postEditText(config, translatedTexts, translationMetadata) {
  console.log('[PostEdit] Starting post-editing stage');

  // Filter to only successful translations
  const validMetadata = translationMetadata.filter(meta => meta.success);

  if (validMetadata.length === 0) {
    console.log('[PostEdit] No successful translations to post-edit');
    return translatedTexts;
  }

  const client = new LLMClient({
    llmId: config.llm.postEdit,
    stageId: "5",
    stageLabel: "Post Editing",
  });

  try {
    const promptBuilder = await getPromptBuilder(config.languagePair, 'post-edit');

    const languageSpecificConfig = config.translation;

    // Build prompts for each valid chunk
    const promptData = validMetadata.map(meta => {
      const prompt = promptBuilder.build(
        meta.sourceText,
        meta.translatedText,
        {
          precedingText: meta.precedingText,
          glossaryEntries: meta.relevantEntries,
          customInstruction: config.customInstruction,
        },
        languageSpecificConfig,
      );

      return {
        interval: meta.interval,
        prompt,
      };
    });

    const prompts = promptData.map(d => d.prompt);

    // Send to LLM
    const results = await client.requestBatch(prompts);

    const processor = new PostEditProcessor();

    // Process each response, parse LLM actions and execute
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const { interval } = promptData[i];
      const [start, end] = interval;

      if (!result.ok) {
        console.error(`Post-edit failed for interval [${start}, ${end}]:`, result.error);
        continue;
      }

      // Extract translated lines for this interval
      const intervalTexts = translatedTexts.slice(start, end + 1);
      const originalLines = intervalTexts
        .map(t => t.translatedText)
        .filter(Boolean); // Skip nulls

      if (originalLines.length === 0) {
        console.warn(`No valid translations in interval [${start}, ${end}] to post-edit`);
        continue;
      }

      // Process the post-edit operations
      const { edited, preQC } = processor.process(originalLines, result.data);

      // Check if any changes were made
      const hasChanges = edited.some((line, idx) => line !== preQC[idx]) ||
        edited.length !== preQC.length;

      if (hasChanges) {

        // Map edited lines back to translatedTexts
        // Handle line count mismatches similar to translation stage
        let editIndex = 0;
        for (let j = start; j <= end; j++) {
          const text = translatedTexts[j];

          if (text.translatedText !== null && text.translatedText !== undefined) {
            // Store pre-QC version for debugging or for users to check what was changed
            text.preQC = preQC[editIndex] || text.translatedText;

            // Update with the edited version
            if (editIndex < edited.length) {
              text.translatedText = edited[editIndex];
              editIndex++;
            } else {
              // More original lines than edited lines
              text.translatedText = null;
            }
          }
        }

        // If we have extra edited lines, combine them into the last text
        if (editIndex < edited.length) {
          const lastText = translatedTexts[end];
          const extraLines = edited.slice(editIndex);
          lastText.translatedText = (lastText.translatedText || '') + '\n' + extraLines.join('\n');
        }
      }
    }

    return translatedTexts;

  } finally {
    client.dispose();
  }
}