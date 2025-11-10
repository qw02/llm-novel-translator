/**
 * content/pipeline.js
 *
 * Main pipeline orchestrator
 */

import { getProgressTracker } from '../progress-tracking.js';

import { generateGlossary } from './glossary-generate/glossary-generate.js';
import { updateGlossary } from './glossary-update/glossary-update.js';
import { segmentText } from './text-segmentation/text-segmentation.js';
import { translateText } from './translation/translation.js';
import { postEditText } from './post-edit/post-edit.js';

export async function runPipeline(extractedText, config) {
  console.log('[Pipeline] Starting translation pipeline');

  const progressTracker = getProgressTracker();

  try {
    // Preprocessing: Unicode normalization, etc.
    console.log('[Pipeline] Preprocessing...');
    const texts = extractedText.map(item => ({
      ...item,
      text: item.text.normalize('NFC'),
    }));

    // Mock object for testing
    // Actual will be loaded from background / storage
    let glossary = {
      "entries": [
        {
          "id": 1,
          "keys": ["no-intersection", "key_1234567"],
          "value": "[character] Name: Ace (エース) | Gender: Female",
        },
        {
          "id": 3,
          "keys": ["ジャック", "key-to-delete-456"],
          "value": "[character] Name: Jack (ジャック) | Gender: Male",
        },
      ],
    };

    if (config.updateGlossary) {
      // Stage 1: Glossary Generation
      const newEntries = await generateGlossary(config, texts);

      // Stage 2: Glossary Update
      glossary = await updateGlossary(config, glossary, newEntries);
    }

    // Stage 3: Text Splitting
    console.log('[Pipeline] Stage 3: Text Splitting');
    const intervals = await segmentText(config, texts);

    console.log(`Intervals: ${JSON.stringify(intervals)}`);





    // Stage 4: Text Translation
    // console.log('[Pipeline] Stage 4: Text Translation');
    // const translatedChunks = await translateText(config, texts);

    // Stage 5: Post Editing
    // let finalTranslation = translatedChunks;
    // if (config.postEdit) {
    //   console.log('[Pipeline] Stage 5: Post Editing');
    //   finalTranslation = await postEditText(config, texts, intervals, translatedChunks);
    //   editClient.dispose();
    // }

    // Reconstruct output format matching input
    // const output = extractedText.map((item, index) => ({
    //   ...item,
    //   translation: finalTranslation[index],
    // }));

    console.log('[Pipeline] Pipeline completed successfully');
    // return output;

  } catch (error) {
    console.error('[Pipeline] Pipeline failed:', error);
    throw error;
  }
}
