/**
 * content/main.js
 *
 * Entry point for content script - receives messages from popup and coordinates everything
 */

import { runPipeline } from './pipeline/pipeline.js';
import { getTranslationConfig } from './config/config.js';
import { extractText, replaceText, buildGlossaryKeys } from './dom-adapter.js';
import { getGlossary, saveGlossary } from './glossary.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pipeline.start') {

    handlePipelineStart().then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      console.error('[Main] Pipeline failed:', error);
      sendResponse({ ok: false, error: error.message });
    });

    return true;
  }
});

async function handlePipelineStart() {
  try {
    // Step 1: Extract text from webpage
    const extractedText = extractText();

    // Step 2: Obtain the config (persistant from options page, user-set in pop-up, values based on website content, etc.)
    console.log('[Main] Step 2: Aggregating configuration...');
    const config = getTranslationConfig();
    if (!config.valid) {
      throw new Error('Configuration validation failed');
    }

    // if (!config.translation.valid) {
    // TODO: Show warning (page and selected language seems different), user can choose to bypass
    // Use lib to get language of `extractedText`
    // Compare to translation source
    // }

    console.log('[Main] Configuration valid');

    // Read in glossary for this series from storage
    const glossaryStorageKeys = buildGlossaryKeys(config.sourceLang, config.targetLang);
    const glossary = await getGlossary(glossaryStorageKeys.seriesKey);

    // Run the main translation pipeline
    const { translatedText: translatedText, glossary: updatedGlossary } = await runPipeline(extractedText, glossary, config);

    // Save the updated glossary (will be the same if update not ran
    await saveGlossary(glossaryStorageKeys, glossary);

    // Write translation back to webpage DOM
    replaceText(translatedText);

  } catch (error) {
    console.error('[Main] Error in pipeline:', error);
    throw error;
  }
}

console.log('[Main] Content script loaded and ready');
