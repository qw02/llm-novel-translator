import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initializeDefaultConfig } from '../main.js';
import { TOP_RECOMMENDED_MODEL } from '../config/defaults.js';

describe('background first-install logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize translation_config when storage is empty', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    await initializeDefaultConfig();

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    const setCall = chrome.storage.local.set.mock.calls[0][0];
    expect(setCall).toHaveProperty('translation_config');

    const config = setCall.translation_config;
    expect(config.sourceLang).toBe('ja');
    expect(config.targetLang).toBe('en');
    expect(config.llm.translation).toBe(TOP_RECOMMENDED_MODEL.id);
    expect(config.llm.glossaryGenerate).toBe(TOP_RECOMMENDED_MODEL.id);
    expect(config.llm.glossaryUpdate).toBe(TOP_RECOMMENDED_MODEL.id);
    expect(config.llm.textChunking).toBe(TOP_RECOMMENDED_MODEL.id);
    expect(config.llm.fallback).toBe(TOP_RECOMMENDED_MODEL.id);
  });

  it('should not overwrite existing translation_config', async () => {
    const existing = {
      sourceLang: 'zh',
      targetLang: 'en',
      llm: { translation: 'user-custom-model' },
    };
    chrome.storage.local.get.mockResolvedValue({ translation_config: existing });

    await initializeDefaultConfig();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
