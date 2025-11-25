/**
 * Entry point for content script
 */

import { runPipeline } from './pipeline/pipeline.js';
import { getTranslationConfig, validateConfig } from './config/config.js';
import { extractText, replaceText, buildGlossaryKeys } from './dom-adapter.js';
import { getGlossary, saveGlossary } from './ui/glossary.js';
import { isSiteSupported } from "../domains/registry.js";
import { getProgressTracker } from "./progress-tracking.js";
import { POPUP_MSG_TYPE } from "../common/messaging.js";
import { openGlossaryEditor } from "./ui/glossary-manager.js";
import { showTextPreview } from "./ui/preview-manager.js";

// --- Lifecycle State Management ---
const PipelineStatus = {
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  WARNING_PENDING: 'WARNING_PENDING',
  RUNNING: 'RUNNING',
  COMPLETE_SUCCESS: 'COMPLETE_SUCCESS',
  COMPLETE_ERROR: 'COMPLETE_ERROR',
};

// The master state object
const pipelineContext = {
  status: PipelineStatus.IDLE,
  error: null,   // For hard errors
  warning: null, // For validation warnings
  startTime: null,
};

// Temp data store while waiting for the confirmation signal to continue from popup
let pendingContext = null;

// Check if the global flag exists. If it does, we stop immediately.
// Popup should not attempt load, but just in case.
if (!window.hasLLMTranslatorLoaded) {
  window.hasLLMTranslatorLoaded = true;
  console.log('[Main] Content script loaded and ready.');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Stops duplicate loading of content script when popup opens again
    if (message.type === POPUP_MSG_TYPE.ping) {
      sendResponse({ status: 'alive' });
      return false;
    }

    // --- 1. Start Request ---
    if (message.type === POPUP_MSG_TYPE.pipeline_start) {

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

      return true;
    }

    // --- 2. Continue Request (User confirmed warning) ---
    if (message.type === POPUP_MSG_TYPE.pipeline_continue) {

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

    if (message.type === POPUP_MSG_TYPE.pipeline_getState) {
      sendResponse({ success: true, state: pipelineContext });
      return false;
    }

    if (message.type === POPUP_MSG_TYPE.get_progress_state) {
      if (pipelineContext.status === PipelineStatus.IDLE) {
        sendResponse({ success: true, data: null });
      } else {
        const tracker = getProgressTracker();
        sendResponse({ success: true, data: tracker.getState() });
      }
      return true;
    }

    if (message.type === POPUP_MSG_TYPE.site_supported) {
      try {
        const supported = isSiteSupported();
        sendResponse({ ok: true, supported });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
      return false;
    }

    if (message.type === POPUP_MSG_TYPE.glossary_showWidget) {
      const sourceLang = message.sourceLang || 'ja';
      const targetLang = message.targetLang || 'en';

      openGlossaryEditor(sourceLang, targetLang).catch(err => console.error(err));
      sendResponse({ success: true });
    }

    if (message.type === POPUP_MSG_TYPE.display_preview) {
      try {
        showTextPreview();
        sendResponse({ success: true });
      } catch (e) {
        console.error('Preview failed', e);
        sendResponse({ success: false, error: e.message });
      }
    }

    return false;
  });
}

/**
 * Text extraction / config validation
 */
async function handlePipelineStart(payload) {
  pipelineContext.status = PipelineStatus.VALIDATING;

  // Step 1: Extract text
  const extractedText = extractText();

  // Step 2: Get Config (applying any overrides from popup, e.g. skipGlossary)
  const config = await getTranslationConfig(payload?.overrides);

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
      warning: validation.warning,
    }).catch(() => {
      // If popup is closed, this fails silently.
      // Since validation is fast (~10ms), the user sees this if the popup is open.
      // If they closed it, reopening and clicking translate again will just re-trigger this.
    });

    return { status: 'warning_pending' };
  }

  // --- Branch C: Success (Proceed) ---
  executePipelineCore(extractedText, config).catch(err => {
    console.error("Background pipeline error:", err);
  });
  return { status: 'started' };
}

/**
 * Start translation pipeline
 */
async function executePipelineCore(extractedText, config) {
  // Enable warning listener
  window.addEventListener('beforeunload', handleBeforeUnload);

  try {
    pipelineContext.status = PipelineStatus.RUNNING;
    pipelineContext.error = null;
    pipelineContext.warning = null;
    pendingContext = null;

    // Read in glossary from disk
    const glossaryStorageKeys = buildGlossaryKeys(config.sourceLang, config.targetLang);
    const glossary = await getGlossary(glossaryStorageKeys.seriesKey);

    // console.log('@@ DEBUG Skipping pipeline logic in `main.js`');
    // console.log(extractedText)
    // return;

    const { translatedText, glossary: updatedGlossary } = await runPipeline(extractedText, glossary, config);

    // Save updated glossary (if enabled) to disk
    await saveGlossary(glossaryStorageKeys.seriesKey, updatedGlossary);

    replaceText(translatedText);

    pipelineContext.status = PipelineStatus.COMPLETE_SUCCESS;
  } catch (error) {
    pipelineContext.status = PipelineStatus.COMPLETE_ERROR;
    pipelineContext.error = { message: err.message };
    console.error('[Main] Error in pipeline execution:', error);
    throw error;
  } finally {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}

// Emit warning for tab close when pipeline is running
const handleBeforeUnload = (event) => {
  event.preventDefault();
  // Chrome requires returnValue to be set.
  event.returnValue = '';
  return '';
};
