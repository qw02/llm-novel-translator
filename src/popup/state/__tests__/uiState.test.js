import { describe, it, expect } from 'vitest';
import { UiState, computeUiState } from '../uiState.js';

describe('computeUiState', () => {
  it('returns WELCOME when no API key and no Local LLM are configured', () => {
    const state = computeUiState({
      hasApiKeys: false,
      hasLocalLlm: false,
      siteSupported: true,
      pipelineState: { status: 'IDLE' },
    });
    expect(state).toBe(UiState.WELCOME);
  });

  it('returns IDLE_SUPPORTED when only Local LLM is configured', () => {
    const state = computeUiState({
      hasApiKeys: false,
      hasLocalLlm: true,
      siteSupported: true,
      pipelineState: { status: 'IDLE' },
    });
    expect(state).toBe(UiState.IDLE_SUPPORTED);
  });

  it('returns IDLE_SUPPORTED when only an API key is configured', () => {
    const state = computeUiState({
      hasApiKeys: true,
      hasLocalLlm: false,
      siteSupported: true,
      pipelineState: { status: 'IDLE' },
    });
    expect(state).toBe(UiState.IDLE_SUPPORTED);
  });
});
