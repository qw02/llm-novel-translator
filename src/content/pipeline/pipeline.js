/**
 * Main pipeline orchestrator
 */

import { getProgressTracker } from '../progress-tracking.js';
import { generateGlossary } from './glossary-generate/glossary-generate.js';
import { updateGlossary } from './glossary-update/glossary-update.js';
import { segmentText } from './text-segmentation/text-segmentation.js';
import { translateText } from "./translation/translation.js";
import { postEditText } from "./post-edit/post-edit.js";

export async function runPipeline(texts, glossary, config) {
  // Init object
  getProgressTracker();

  try {
    let updatedGlossary = undefined;
    if (config.updateGlossary) {
      // Stage 1: Glossary Generation
      const newEntries = await generateGlossary(config, texts);

      // Stage 2: Glossary Update
      updatedGlossary = await updateGlossary(config, glossary, newEntries);
    }

    // Stage 3: Text Splitting
    const intervals = await segmentText(config, texts);

    // Stage 4: Text Translation
    const { translatedTexts, translationMetadata } = await translateText(config, texts, updatedGlossary ?? glossary, intervals);

    // If the post-edit step is not run, return it without modification
    let finalTranslations = translatedTexts;

    // Stage 5: Post Editing
    if (config.postEdit) {
      console.log('5');
      finalTranslations = await postEditText(config, translatedTexts, translationMetadata);
    }

    return { translatedText: finalTranslations, glossary: updatedGlossary ?? glossary }

  } catch (error) {
    console.error('[Pipeline] Pipeline failed:', error);
    throw error;
  }
}
