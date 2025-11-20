export const UiState = {
  WELCOME: "WELCOME",
  IDLE_SUPPORTED: "IDLE_SUPPORTED",
  IDLE_UNSUPPORTED: "IDLE_UNSUPPORTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE_SUCCESS: "COMPLETE_SUCCESS",
  COMPLETE_ERROR: "COMPLETE_ERROR",
};

/**
 * Computes which high-level UI state to show.
 *
 * @param {Object} args
 * @param {boolean} args.hasApiKeys
 * @param {boolean} args.siteSupported
 * @param {Object|null} args.pipelineState
 */
export function computeUiState({ hasApiKeys, siteSupported, pipelineState }) {
  if (!hasApiKeys) {
    return UiState.WELCOME;
  }

  const status = pipelineState?.status || "idle";

  if (status === "running" || status === "in_progress") {
    return UiState.IN_PROGRESS;
  }

  if (status === "complete_success" || status === "done") {
    return UiState.COMPLETE_SUCCESS;
  }

  if (status === "complete_error" || pipelineState?.error) {
    return UiState.COMPLETE_ERROR;
  }

  // Idle states based on site support
  if (siteSupported) {
    return UiState.IDLE_SUPPORTED;
  } else {
    return UiState.IDLE_UNSUPPORTED;
  }
}
