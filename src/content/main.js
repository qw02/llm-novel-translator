/**
 * content/main.js
 *
 * Entry point - receives messages from popup and coordinates everything
 */

import { runPipeline } from './pipeline/pipeline.js';
import { extractText } from './extractors/test-page.js';
import { replaceText } from './replacers/replacer.js';
import { getTranslationConfig } from './config/config.js';

// Listen for pipeline start message from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'pipeline.start') {

    // Run pipeline asynchronously
    handlePipelineStart().then(() => {
      console.log('[Main] Pipeline completed successfully');
      sendResponse({ ok: true });
    }).catch((error) => {
      console.error('[Main] Pipeline failed:', error);
      sendResponse({ ok: false, error: error.message });
    });

    return true; // Keep channel open for async response
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
    //   // Show warning (page and selected language seems different), user can choose to bypass
    // }

    console.log('[Main] Configuration valid');

    // Step 3: Run translation pipeline
    console.log('[Main] Step 3: Starting translation pipeline...');
    const translatedText = await runPipeline(extractedText, config);
    console.log('[Main] Pipeline completed, received translations');

    // Step 4: Replace text on webpage
    console.log('[Main] Step 4: Replacing text on webpage...');
    replaceText(translatedText);
    console.log('[Main] Text replacement complete');

  } catch (error) {
    console.error('[Main] Error in pipeline:', error);
    throw error;
  }
}

console.log('[Main] Content script loaded and ready');