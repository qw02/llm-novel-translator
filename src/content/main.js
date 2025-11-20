/**
 * content/main.js
 *
 * Entry point for content script - receives messages from popup and coordinates everything
 */

import { runPipeline } from './pipeline/pipeline.js';
import { getTranslationConfig, validateConfig } from './config/config.js';
import { extractText, replaceText, buildGlossaryKeys } from './dom-adapter.js';
import { getGlossary, saveGlossary } from './glossary.js';
import { isSiteSupported } from "../domains/registry.js";

let pendingContext = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // --- 1. Start Request ---
  if (message.type === 'pipeline.start') {

    // Reset any old pending context
    pendingContext = null;

    handlePipelineStart(message.payload)
      .then((result) => {
        // result can be { status: 'started' } or { status: 'warning_pending' }
        sendResponse({ ok: true, ...result });
      })
      .catch((error) => {
        console.error('[Main] Pipeline start failed:', error);
        sendResponse({ ok: false, error: error.message });
      });

    return true; // Keep channel open for async response
  }

  // --- 2. Continue Request (User confirmed warning) ---
  if (message.type === 'pipeline.continue') {

    if (!pendingContext) {
      sendResponse({ ok: false, error: 'No pending pipeline to continue.' });
      return false;
    }

    // Resume execution immediately using the stored data
    executePipelineCore(pendingContext.extractedText, pendingContext.config)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        console.error('[Main] Pipeline continuation failed:', error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  if (message.type === "site.supported") {
    try {
      const supported = isSiteSupported(); // Use current loc if url not provided
      sendResponse({ ok: true, supported });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return false;
  }
});

/**
 * Text extraction / config validation
 */
async function handlePipelineStart(payload) {
  // Step 1: Extract text
  const extractedText = extractText();

  // Step 2: Get Config (applying any overrides from popup, e.g. skipGlossary)
  console.log('[Main] Step 2: Aggregating configuration...');
  const config = await getTranslationConfig(payload?.overrides);
  console.log("Config loaded");
  console.log(config);

  // Step 3: Validation
  const validation = await validateConfig(config, extractedText);

  // --- Branch A: Hard Error ---
  if (!validation.ok) {
    throw new Error(`Unable to start translation pipeline: ${validation.error ?? 'Validation failed'}`);
  }

  // --- Branch B: Warning (Pause Execution) ---
  if (validation.ok && validation.warning) {
    // Save state to memory
    pendingContext = { extractedText, config };

    // Send active message to popup to trigger the Modal
    chrome.runtime.sendMessage({
      type: 'validation.warning',
      warning: validation.warning
    }).catch(() => {
      // If popup is closed, this fails silently.
      // Since validation is fast (~10ms), the user sees this if the popup is open.
      // If they closed it, reopening and clicking translate again will just re-trigger this.
    });

    return { status: 'warning_pending' };
  }

  // --- Branch C: Success (Proceed) ---
  await executePipelineCore(extractedText, config);
  return { status: 'started' };
}

/**
 * Start translation pipeline
 */
async function executePipelineCore(extractedText, config) {
  console.log('@@ DEBUG Skipping pipeline logic in `main.js`');
  return;

  try {
    pendingContext = null;

    // Read in glossary
    const glossaryStorageKeys = buildGlossaryKeys(config.sourceLang, config.targetLang);
    const glossary = await getGlossary(glossaryStorageKeys.seriesKey);

    // --- Run the Pipeline ---
    const { translatedText, glossary: updatedGlossary } = await runPipeline(extractedText, glossary, config);

    // Save glossary
    await saveGlossary(glossaryStorageKeys, updatedGlossary);

    // Replace Text
    replaceText(translatedText);

  } catch (error) {
    console.error('[Main] Error in pipeline execution:', error);
    throw error;
  }
}

console.log('[Main] Content script loaded and ready');
