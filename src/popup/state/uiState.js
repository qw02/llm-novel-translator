export const UiState = {
  WELCOME: "WELCOME",
  IDLE_SUPPORTED: "IDLE_SUPPORTED",
  IDLE_UNSUPPORTED: "IDLE_UNSUPPORTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE_SUCCESS: "COMPLETE_SUCCESS",
  COMPLETE_ERROR: "COMPLETE_ERROR",
};

export function computeUiState({ hasApiKeys, siteSupported, pipelineState }) {
  if (!hasApiKeys) {
    return UiState.WELCOME;
  }

  const status = pipelineState?.status || "IDLE";
  console.log(status)

  if (status === "RUNNING" || status === "VALIDATING") {
    return UiState.IN_PROGRESS;
  }

  if (status === "COMPLETE_SUCCESS") {
    return UiState.COMPLETE_SUCCESS;
  }

  if (status === "COMPLETE_ERROR" || pipelineState?.error) {
    return UiState.COMPLETE_ERROR;
  }

  return siteSupported ? UiState.IDLE_SUPPORTED : UiState.IDLE_UNSUPPORTED;
}
