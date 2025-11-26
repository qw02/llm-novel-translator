/**
 * Stage 2: Merge new glossary entries with the existing dictionary
 */
import { LLMClient } from "../../llm-client.js";
import { getPromptBuilder } from "../../prompts/index.js";
import { GlossaryUpdater } from "./updater.js";

/**
 * Main entry point for glossary updates
 *
 * @param {Object} config - Configuration object
 * @param {Object} existingGlossary - Existing glossary with structure { entries: [...] }
 * @param {Array} newEntries - Array of new entries to merge, each with { keys: string[], value: string }
 * @returns {Promise<Object>} Updated glossary
 */
export async function updateGlossary(config, existingGlossary, newEntries) {
  if (!newEntries || newEntries.length === 0) {
    return existingGlossary;
  }

  const client = new LLMClient({
    llmId: config.llm.glossaryUpdate,
    stageId: "2",
    stageLabel: "Glossary Update",
  });

  try {
    const promptBuilder = await getPromptBuilder(config.languagePair, 'glossary-update');

    const updater = new GlossaryUpdater(client, promptBuilder, config);
    const result = await updater.update(existingGlossary, newEntries);

    return result;
  } finally {
    client.dispose();
  }
}
