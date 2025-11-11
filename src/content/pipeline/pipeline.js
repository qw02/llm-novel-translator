/**
 * Main pipeline orchestrator
 */

import { getProgressTracker } from '../progress-tracking.js';

import { generateGlossary } from './glossary-generate/glossary-generate.js';
import { updateGlossary } from './glossary-update/glossary-update.js';
import { segmentText } from './text-segmentation/text-segmentation.js';
import { translateText } from "./translation/translation.js";
import { postEditText } from "./post-edit/post-edit.js";

export async function runPipeline(texts, config) {
  console.log('[Pipeline] Starting translation pipeline');

  const progressTracker = getProgressTracker();

  try {
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
        {
          "id": 11,
          "keys": [
            "東雲",
            "しののめ"
          ],
          "value": "[character] Name: Shinonome (東雲) | Gender: Female | Note: Referred to as 'Ice Princess' (氷姫)"
        },
        {
          "id": 12,
          "keys": [
            "瑛二",
            "えいじ"
          ],
          "value": "[character] Name: Eiji (瑛二) | Gender: Male"
        },
        {
          "id": 13,
          "keys": [
            "羽山光",
            "はやまひかる",
            "羽山"
          ],
          "value": "[character] Name: Hayama Hikaru (羽山光) | Gender: Female | Note: Blonde hair, outgoing personality"
        },
        {
          "id": 14,
          "keys": [
            "氷姫",
            "こおりひめ"
          ],
          "value": "[term] Meaning: Ice Princess | Note: Nickname for Shinonome (東雲)"
        }
      ],
    };

    if (config.updateGlossary) {
      // Stage 1: Glossary Generation
      const newEntries = await generateGlossary(config, texts);

      // Stage 2: Glossary Update
      glossary = await updateGlossary(config, glossary, newEntries);
    }

    // Stage 3: Text Splitting
    const intervals = await segmentText(config, texts);


    // Stage 4: Text Translation
    console.log('[Pipeline] Stage 4: Text Translation');
    const { translatedTexts, translationMetadata } = await translateText(config, texts, glossary, intervals);

    // If the post-edit step is not run, return it without modification
    let finalTranslations = translatedTexts;

    // Stage 5: Post Editing
    if (config.postEdit) {
      console.log('[Pipeline] Stage 5: Post Editing');
      finalTranslations = await postEditText(config, translatedTexts, translationMetadata);
    }

    console.log('[Pipeline] Pipeline completed successfully');
    return finalTranslations

  } catch (error) {
    console.error('[Pipeline] Pipeline failed:', error);
    throw error;
  }
}
