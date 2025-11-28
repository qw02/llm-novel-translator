import {
  getApiKeys,
  getConfigFromDisk,
  getActiveTab,
  querySiteSupported,
  getPipelineLifecycleState,
  getLlmProgress,
  startPipeline,
  continuePipeline,
  openOptionsPage,
  showGlossaryWidget,
  showPreview,
  getPopupLanguageOverrides,
  setPopupLanguageOverrides, cancelPipeline,
} from "./extensionApi.js";

import { UiState, computeUiState } from "./state/uiState.js";

import { renderWelcomeView } from "./views/welcomeView.js";
import { renderIdleReadyView } from "./views/idleReadyView.js";
import { renderIdleUnsupportedView } from "./views/idleUnsupportedView.js";
import { renderInProgressView } from "./views/inProgressView.js";
import { renderCompleteView } from "./views/completeView.js";
import {
  showWarningOverlay,
  removeWarningOverlayIfAny,
} from "./views/warningOverlay.js";
import { POPUP_MSG_TYPE } from "../common/messaging.js";


let appRoot = null;
let currentTab = null;
let currentUiState = null;
let progressTimer = null;

let skipGlossary = false;
let lastPopupError = null;

let currentConfig = null;
let currentSourceLang = null;
let currentTargetLang = null;

// Entry point
window.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (isRestrictedPage(tab?.url)) {
    window.close();
    return;
  }

  // Load the content script if needed
  try {
    await chrome.tabs.sendMessage(tab.id, { type: POPUP_MSG_TYPE.ping });
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content/main.js"],
      });
    } catch {
      // Restricted page that slipped through URL check; close silently
      window.close();
      return;
    }
  }

  appRoot = document.getElementById("app");
  initPopup().catch((err) => {
    console.error("[popup] init failed", err);
    if (appRoot) {
      appRoot.textContent = "Failed to load popup.";
    }
  });
});

// Listen for async warnings from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "validation.warning" && message.warning) {
    // Show overlay; continuation is wired in initPopup/refresh
    if (currentTab?.id) {
      handleWarningFromContentScript(message.warning).catch((err) =>
        console.error("[popup] warning handler failed", err),
      );
    }
    sendResponse({ ok: true });
    return false;
  }
});

/**
 * Returns true if the URL belongs to a restricted page where
 * content scripts cannot be injected.
 */
const isRestrictedPage = (url) => {
  if (!url) return true;

  const restrictedPatterns = [
    /^chrome:\/\//,
    /^edge:\/\//,
    /^about:/,
    /^chrome-extension:\/\//,
    /^https:\/\/chrome\.google\.com\/webstore/,
    /^https:\/\/chromewebstore\.google\.com/,
    /^https:\/\/microsoftedge\.microsoft\.com\/addons/,
  ];

  return restrictedPatterns.some((pattern) => pattern.test(url));
};

/**
 * Main initialization: load API keys, tab, config, pipeline state, then render.
 */
async function initPopup() {
  currentTab = await getActiveTab();
  await refresh();
}

/**
 * Refreshes the view by recomputing UI state from latest data.
 */
async function refresh() {
  if (!appRoot) return;

  clearProgressTimer();
  appRoot.innerHTML = `<h1 class="loading-title">Loading…</h1>`;

  const [apiKeys, config] = await Promise.all([
    getApiKeys(),
    getConfigFromDisk(),
  ]);

  currentConfig = config || null;

  const hasApiKeys = apiKeys && Object.keys(apiKeys).length > 0;
  let siteSupported = false;
  let pipelineState = null;

  if (currentTab?.id) {
    // Ask content script if this site is supported
    try {
      siteSupported = await querySiteSupported(currentTab.id);
    } catch (err) {
      console.warn("[popup] querySiteSupported failed:", JSON.stringify(err));
      siteSupported = false;     }

    try {
      pipelineState = await getPipelineLifecycleState(currentTab.id);
    } catch {
      pipelineState = { status: "IDLE" };
    }
  }

  let langOverrides = {};
  if (currentTab?.id) {
    langOverrides = await getPopupLanguageOverrides(currentTab.id);
  }

  const baseSourceLang = currentConfig?.sourceLang || "ja";
  const baseTargetLang = currentConfig?.targetLang || "en";

  // If session has override, use it; otherwise use disk config
  currentSourceLang = langOverrides.popupSourceLang || baseSourceLang;
  currentTargetLang = langOverrides.popupTargetLang || baseTargetLang;

  const uiState = computeUiState({ hasApiKeys, siteSupported, pipelineState });
  currentUiState = uiState;

  const renderContext = {
    root: appRoot,
    apiKeys,
    config: currentConfig,
    siteSupported,
    pipelineState,
    tab: currentTab,
    popupError: lastPopupError,
    skipGlossary,
    selectedSourceLang: currentSourceLang,
    selectedTargetLang: currentTargetLang,
    onOpenOptions: handleOpenOptions,
    onTranslate: handleTranslateClick,
    onShowGlossary: handleShowGlossaryClick,
    onShowPreview: handleShowPreviewClick,
    onToggleSkipGlossary: handleToggleSkipGlossary,
    onSourceLangChange: handleSourceLangChange,
    onTargetLangChange: handleTargetLangChange,
  };

  renderView(uiState, renderContext);

  if (pipelineState?.status === "warning_pending" && pipelineState.warning) {
    await handleWarningFromContentScript(pipelineState.warning);
  }

  // Only when we need to show in-progress do we start polling LLM progress
  if (uiState === UiState.IN_PROGRESS && currentTab?.id) {
    startProgressTimer(currentTab.id);
  }
}

/**
 * Renders the appropriate sub-view for the current UI state.
 */
function renderView(uiState, context) {
  const { root, pipelineState, progressData = null } = context;

  if (!root) return;

  switch (uiState) {
    case UiState.WELCOME:
      renderWelcomeView(root, {
        onOpenOptions: context.onOpenOptions,
      });
      break;

    case UiState.IDLE_SUPPORTED:
      renderIdleReadyView(root, {
        config: context.config,
        popupError: context.popupError,
        skipGlossary: context.skipGlossary,
        selectedSourceLang: context.selectedSourceLang,
        selectedTargetLang: context.selectedTargetLang,
        onOpenOptions: context.onOpenOptions,
        onTranslate: () => context.onTranslate(context.tab),
        onShowGlossary: () => context.onShowGlossary(context.tab),
        onToggleSkipGlossary: context.onToggleSkipGlossary,
        onSourceLangChange: context.onSourceLangChange,
        onTargetLangChange: context.onTargetLangChange,
      });
      break;

    case UiState.IDLE_UNSUPPORTED:
      renderIdleUnsupportedView(root, {
        config: context.config,
        popupError: context.popupError,
        skipGlossary: context.skipGlossary,
        selectedSourceLang: context.selectedSourceLang,
        selectedTargetLang: context.selectedTargetLang,
        onOpenOptions: context.onOpenOptions,
        onTranslate: () => context.onTranslate(context.tab),
        onShowGlossary: () => context.onShowGlossary(context.tab),
        onShowPreview: () => context.onShowPreview(context.tab),
        onToggleSkipGlossary: context.onToggleSkipGlossary,
        onSourceLangChange: context.onSourceLangChange,
        onTargetLangChange: context.onTargetLangChange,
      });
      break;

    case UiState.IN_PROGRESS:
      renderInProgressView(root, {
        pipelineState,
        progressData,
      });
      break;

    case UiState.COMPLETE_SUCCESS:
      renderCompleteView(root, {
        kind: "success",
        pipelineState: pipelineState,
      });
      break;

    case UiState.COMPLETE_ERROR:
      renderCompleteView(root, {
        kind: "error",
        pipelineState: pipelineState,
      });
      break;

    default:
      root.textContent = "Unknown state.";
      break;
  }
}

/**
 * Starts polling the content script for the pipeline state every second.
 */
function startProgressTimer(tabId) {
  clearProgressTimer();

  progressTimer = setInterval(async () => {
    try {
      // 1. Ask content script for lifecycle state
      const pipelineState = await getPipelineLifecycleState(tabId);

      // If no longer running, stop polling and do a full refresh()
      if (!pipelineState || pipelineState.status !== "RUNNING") {
        clearProgressTimer();
        await refresh();
        return;
      }

      // 2. Now, and only now, ask for granular LLM progress
      const progressData = await getLlmProgress(tabId);

      // 3. Re-render only the in-progress view with fresh metrics
      renderView(UiState.IN_PROGRESS, {
        root: appRoot,
        apiKeys: null,
        config: currentConfig,
        siteSupported: true,
        pipelineState,
        progressData,
        tab: currentTab,
        popupError: lastPopupError,
        skipGlossary,
        selectedSourceLang: currentSourceLang,
        selectedTargetLang: currentTargetLang,
        onOpenOptions: handleOpenOptions,
        onTranslate: handleTranslateClick,
        onShowGlossary: handleShowGlossaryClick,
        onShowPreview: handleShowPreviewClick,
        onToggleSkipGlossary: handleToggleSkipGlossary,
        onSourceLangChange: handleSourceLangChange,
        onTargetLangChange: handleTargetLangChange,
      });
    } catch (err) {
      console.error("[popup] progress polling failed", err);
      clearProgressTimer();
    }
  }, 1000);
}

function clearProgressTimer() {
  if (progressTimer != null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

/**
 * Handles click on "Translate".
 */
async function handleTranslateClick(tab) {
  if (!tab?.id) return;
  lastPopupError = null;

  const baseSourceLang = currentConfig?.sourceLang || "ja";
  const baseTargetLang = currentConfig?.targetLang || "en";

  // Use currently selected values (state initialized in refresh)
  const src = currentSourceLang;
  const tgt = currentTargetLang;

  // 1. Validation: Source cannot equal Target
  if (src === tgt) {
    lastPopupError = "Source and Target languages cannot be the same.";
    await refresh();
    return;
  }

  // 2. Construct Payload
  const payload = {
    source: "popup",
    overrides: {
      skipGlossary: skipGlossary
    }
  };

  // Add language overrides ONLY if they differ from disk config
  // Content script `getTranslationConfig` looks for `popupSourceLang` / `popupTargetLang`
  if (src !== baseSourceLang) {
    payload.overrides.popupSourceLang = src;
  }
  if (tgt !== baseTargetLang) {
    payload.overrides.popupTargetLang = tgt;
  }

  try {
    // 1. Send Start Command
    const result = await startPipeline(tab.id, payload);

    // 2. Check Result
    if (result.status === 'started') {
      // 3. IMMEDIATE TRANSITION:
      // Force UI state locally to avoid flicker, then start polling.
      currentUiState = UiState.IN_PROGRESS;

      // This will fetch lifecycle (which is now RUNNING) + progress and render immediately
      startProgressTimer(tab.id);
    }
    else if (result.status === 'warning_pending') {
      // Do nothing; the message listener will trigger the overlay
      // or has already triggered it.
    }

  } catch (err) {
    console.error("[popup] failed to start pipeline", err);
    lastPopupError = err?.message || "Failed to start translation.";
    await refresh();
  }
}

/**
 * Handles click on "Show Glossary".
 */
async function handleShowGlossaryClick(tab) {
  if (!tab?.id) return;

  const src = currentSourceLang || currentConfig?.sourceLang || "ja";
  const tgt = currentTargetLang || currentConfig?.targetLang || "en";

  try {
    await showGlossaryWidget(tab.id, src, tgt);
  } catch (err) {
    console.error("[popup] show glossary failed", err);
  }
}

/**
 * Handles click on "Display Preview" (unsupported sites).
 */
async function handleShowPreviewClick(tab) {
  if (!tab?.id) return;
  try {
    await showPreview(tab.id);
  } catch (err) {
    console.error("[popup] show preview failed", err);
  }
}

/**
 * Handles "Open Options" click.
 */
function handleOpenOptions() {
  openOptionsPage();
}

/**
 * Handles toggle of "Skip Glossary Generation/Update".
 */
function handleToggleSkipGlossary(checked) {
  skipGlossary = Boolean(checked);
}

async function handleSourceLangChange(newCode) {
  currentSourceLang = newCode;
  if (currentTab?.id) {
    await setPopupLanguageOverrides(currentTab.id, {
      popupSourceLang: currentSourceLang,
      popupTargetLang: currentTargetLang,
    });
  }
}

async function handleTargetLangChange(newCode) {
  currentTargetLang = newCode;
  if (currentTab?.id) {
    await setPopupLanguageOverrides(currentTab.id, {
      popupSourceLang: currentSourceLang,
      popupTargetLang: currentTargetLang,
    });
  }
}

/**
 * Displays warning overlay for validation warnings,
 * and hooks up continue/cancel behavior.
 */
async function handleWarningFromContentScript(warning) {
  if (!appRoot || !currentTab?.id) return;

  showWarningOverlay(appRoot, warning, {
    onContinue: async () => {
      try {
        removeWarningOverlayIfAny();

        // 1. Send Continue Command
        await continuePipeline(currentTab.id);

        // 2. IMMEDIATE TRANSITION:
        // Switch to In Progress view immediately
        currentUiState = UiState.IN_PROGRESS;
        startProgressTimer(currentTab.id);

      } catch (err) {
        console.error("[popup] continue pipeline failed", err);
        lastPopupError = err.message;
        await refresh();
      }
    },
    onCancel: async () => {
      removeWarningOverlayIfAny();

      try {
        await cancelPipeline(currentTab.id);
      } catch (err) {
        console.warn("Failed to send cancel signal", err);
      }

      await refresh();
    },
  });
}
