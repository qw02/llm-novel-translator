/**
 * Main pipeline orchestrator
 */

import { getProgressTracker } from '../progress-tracking.js';
import { generateGlossary } from './glossary-generate/glossary-generate.js';
import { updateGlossary } from './glossary-update/glossary-update.js';
import { segmentText } from './text-segmentation/text-segmentation.js';
import { translateText } from "./translation/translation.js";
import { postEditText } from "./post-edit/post-edit.js";
import { log } from "../../common/logger.js";

export async function runPipeline(texts, glossary, config) {


  // Init object
  getProgressTracker(expectedTotalStages(config));

  try {
    let updatedGlossary = undefined;

    if (config.updateGlossary) {
      // Stage 1: Glossary Generation
      log(`Starting glossary generation.`);
      const newEntries = await generateGlossary(config, texts);
      log(`Generated ${newEntries.length} new entries.`);

      // Stage 2: Glossary Update
      updatedGlossary = await updateGlossary(config, glossary, newEntries);
      log(`Completed update, glossary now has ${updatedGlossary.entries.length} entries.`);
    }

    // Stage 3: Text Splitting
    const intervals = await segmentText(config, texts);
    log(`Translating using the segments: ${JSON.stringify(intervals)}`);

    // Stage 4: Text Translation
    const { translatedTexts, translationMetadata } = await translateText(config, texts, updatedGlossary ?? glossary, intervals);

    // If the post-edit step is not run, return it without modification
    let finalTranslations = translatedTexts;

    // Stage 5: Post Editing
    if (config.postEdit) {
      log('Starting post-edit QC step.');
      finalTranslations = await postEditText(config, translatedTexts, translationMetadata);
    }

    return { translatedText: finalTranslations, glossary: updatedGlossary ?? glossary }

  } catch (error) {
    console.error('[Pipeline] Pipeline failed:', error);
    throw error;
  }
}

function expectedTotalStages(config) {
  let total = 1; // TL
  if (config.updateGlossary) {
    total += 2
  }

  // Only this method uses LLM calls
  if (config.textSegmentation.method === "chunk") {
    total += 1
  }

  if (config.postEdit) {
    total += 1
  }

  return total;
}
