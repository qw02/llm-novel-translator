import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranslationConfig, validateConfig } from '../config.js';
import { TOP_RECOMMENDED_MODEL } from '../../../background/config/defaults.js';

describe('content config loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTranslationConfig on fresh install (no stored translation_config)', () => {
    it('should fall back to default translation config and persist it to chrome.storage.local', async () => {
      // Storage has no translation_config
      chrome.storage.local.get.mockImplementation((key) => {
        if (key === 'translation_config') return Promise.resolve({});
        if (key === 'customInstructions') return Promise.resolve({});
        return Promise.resolve({});
      });

      const config = await getTranslationConfig();

      expect(config).toBeDefined();
      expect(config.sourceLang).toBe('ja');
      expect(config.targetLang).toBe('en');
      expect(config.languagePair).toBe('ja_en');
      expect(config.sourceLangName).toBe('Japanese');
      expect(config.targetLangName).toBe('English');

      // Model stages default to TOP_RECOMMENDED_MODEL
      expect(config.llm.translation).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.glossaryGenerate).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.glossaryUpdate).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.textChunking).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.fallback).toBe(TOP_RECOMMENDED_MODEL.id);

      // Verify that default config was saved to chrome.storage.local
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          translation_config: expect.objectContaining({
            sourceLang: 'ja',
            targetLang: 'en',
            llm: expect.objectContaining({
              translation: TOP_RECOMMENDED_MODEL.id,
            }),
          }),
        }),
      );
    });

    it('should apply popup overrides onto defaults', async () => {
      chrome.storage.local.get.mockImplementation((key) => {
        if (key === 'translation_config') return Promise.resolve({});
        if (key === 'customInstructions') return Promise.resolve({});
        return Promise.resolve({});
      });

      const config = await getTranslationConfig({
        skipGlossary: true,
        popupSourceLang: 'zh',
        popupTargetLang: 'en',
      });

      expect(config.sourceLang).toBe('zh');
      expect(config.targetLang).toBe('en');
      expect(config.updateGlossary).toBe(false);
      expect(config.languagePair).toBe('zh_en');
    });

    it('should use stored config when already saved', async () => {
      const storedConfig = {
        sourceLang: 'ko',
        targetLang: 'en',
        updateGlossary: true,
        llm: {
          translation: 'custom-model-id',
          glossaryGenerate: 'custom-model-id',
          glossaryUpdate: 'custom-model-id',
          textChunking: 'custom-model-id',
          fallback: null,
          postEdit: null,
        },
        textSegmentation: {
          method: 'chunk',
          chunkSize: 1500,
          overlapCount: 5,
          targetSize: 'medium',
        },
        translation: {
          contextLines: 3,
        },
        postEdit: false,
      };

      chrome.storage.local.get.mockImplementation((key) => {
        if (key === 'translation_config') {
          return Promise.resolve({ translation_config: storedConfig });
        }
        if (key === 'customInstructions') return Promise.resolve({});
        return Promise.resolve({});
      });

      const config = await getTranslationConfig();

      expect(config.sourceLang).toBe('ko');
      expect(config.llm.translation).toBe('custom-model-id');
      // Should not re-save stored config
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('validateConfig', () => {
    it('should validate default config with valid extracted text', async () => {
      chrome.storage.local.get.mockImplementation((key) => {
        if (key === 'translation_config') return Promise.resolve({});
        if (key === 'customInstructions') return Promise.resolve({});
        return Promise.resolve({});
      });

      const config = await getTranslationConfig();
      const extractedText = [
        { id: '1', index: 0, text: 'これはテスト文章です。吾輩は猫である。名前はまだ無い。' },
      ];

      const validation = await validateConfig(config, extractedText);
      expect(validation.ok).toBe(true);
    });

    it('should fail validation when source and target languages are equal', async () => {
      chrome.storage.local.get.mockImplementation((key) => {
        if (key === 'translation_config') return Promise.resolve({});
        if (key === 'customInstructions') return Promise.resolve({});
        return Promise.resolve({});
      });

      const config = await getTranslationConfig({
        popupSourceLang: 'en',
        popupTargetLang: 'en',
      });
      const extractedText = [{ id: '1', index: 0, text: 'Some text' }];

      const validation = await validateConfig(config, extractedText);
      expect(validation.ok).toBe(false);
      expect(validation.error).toContain('Source and Target languages cannot be the same');
    });
  });
});
