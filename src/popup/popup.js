import {
  getApiKeys,
  getConfigFromDisk,
  getActiveTab,
  querySiteSupported,
  getPipelineState,
  startPipeline,
  continuePipeline,
  openOptionsPage,
  showGlossaryWidget,
  showPreview,
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


let appRoot = null;
let currentTab = null;
let currentUiState = null;
let progressTimer = null;
let skipGlossary = false;
let lastPopupError = null;

// Entry point
window.addEventListener("DOMContentLoaded", () => {
  appRoot = document.getElementById("app");
  initPopup().catch((err) => {
    console.error("[popup] init failed", err);
    if (appRoot) {
      appRoot.textContent = "Failed to load popup.";
    }
  });
});

// Listen for async warnings from content script
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

  const hasApiKeys = apiKeys && Object.keys(apiKeys).length > 0;

  let siteSupported = false;
  let pipelineState = null;

  if (currentTab?.id) {
    // Ask content script if this site is supported
    try {
      siteSupported = await querySiteSupported(currentTab.id);
    } catch (err) {
      console.warn("[popup] querySiteSupported failed:", err);
      siteSupported = false; // conservative fallback
    }

    // And also fetch pipeline state
    try {
      pipelineState = await getPipelineState(currentTab.id);
    } catch {
      pipelineState = null;
    }
  }

  const uiState = computeUiState({ hasApiKeys, siteSupported, pipelineState });
  currentUiState = uiState;

  const renderContext = {
    root: appRoot,
    apiKeys,
    config,
    siteSupported,
    pipelineState,
    tab: currentTab,
    popupError: lastPopupError,
    skipGlossary,
    onOpenOptions: handleOpenOptions,
    onTranslate: handleTranslateClick,
    onShowGlossary: handleShowGlossaryClick,
    onShowPreview: handleShowPreviewClick,
    onToggleSkipGlossary: handleToggleSkipGlossary,
  };

  renderView(uiState, renderContext);

  if (pipelineState?.status === "warning_pending" && pipelineState.warning) {
    await handleWarningFromContentScript(pipelineState.warning);
  }

  if (uiState === UiState.IN_PROGRESS && currentTab?.id) {
    startProgressTimer(currentTab.id);
  }
}

/**
 * Renders the appropriate sub-view for the current UI state.
 */
function renderView(uiState, context) {
  const { root, pipelineState } = context;

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
        onOpenOptions: context.onOpenOptions,
        onTranslate: () => context.onTranslate(context.tab),
        onShowGlossary: () => context.onShowGlossary(context.tab),
        onToggleSkipGlossary: context.onToggleSkipGlossary,
      });
      break;

    case UiState.IDLE_UNSUPPORTED:
      renderIdleUnsupportedView(root, {
        config: context.config,
        popupError: context.popupError,
        skipGlossary: context.skipGlossary,
        onOpenOptions: context.onOpenOptions,
        onTranslate: () => context.onTranslate(context.tab),
        onShowGlossary: () => context.onShowGlossary(context.tab),
        onShowPreview: () => context.onShowPreview(context.tab),
        onToggleSkipGlossary: context.onToggleSkipGlossary,
      });
      break;

    case UiState.IN_PROGRESS:
      renderInProgressView(root, {
        pipelineState: pipelineState,
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
 * Starts polling the content script for pipeline state every second.
 */
function startProgressTimer(tabId) {
  clearProgressTimer();

  progressTimer = setInterval(async () => {
    try {
      const pipelineState = await getPipelineState(tabId);
      const hasApiKeys = true;

      let siteSupported = false;
      if (currentTab?.id) {
        try {
          siteSupported = await querySiteSupported(currentTab.id);
        } catch {
          siteSupported = false;
        }
      }

      const uiState = computeUiState({
        hasApiKeys,
        siteSupported,
        pipelineState,
      });
      currentUiState = uiState;

      renderView(uiState, {
        root: appRoot,
        apiKeys: null,
        config: null,
        siteSupported,
        pipelineState,
        tab: currentTab,
        popupError: lastPopupError,
        skipGlossary,
        onOpenOptions: handleOpenOptions,
        onTranslate: handleTranslateClick,
        onShowGlossary: handleShowGlossaryClick,
        onShowPreview: handleShowPreviewClick,
        onToggleSkipGlossary: handleToggleSkipGlossary,
      });

      if (uiState !== UiState.IN_PROGRESS) {
        clearProgressTimer();
      }
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

  try {
    await startPipeline(tab.id, {
      source: "popup",
      overrides: {
        skipGlossary, // Update set to false if skip glossary toggle enabled
      },
    });
    // The actual state transition will be picked up via polling / refresh.
    await refresh();
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
  try {
    await showGlossaryWidget(tab.id);
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

/**
 * Displays warning overlay for validation warnings,
 * and hooks up continue/cancel behavior.
 */
async function handleWarningFromContentScript(warning) {
  if (!appRoot || !currentTab?.id) return;

  showWarningOverlay(appRoot, warning, {
    onContinue: async () => {
      try {
        await continuePipeline(currentTab.id);
        removeWarningOverlayIfAny();
        await refresh();
      } catch (err) {
        console.error("[popup] continue pipeline failed", err);
      }
    },
    onCancel: async () => {
      removeWarningOverlayIfAny();
      // User cancelled; do nothing else. The pipeline stays not started.
      await refresh();
    },
  });
}
