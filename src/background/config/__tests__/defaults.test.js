import { describe, it, expect } from 'vitest';
import {
  PROVIDER_CONFIGS,
  TOP_RECOMMENDED_MODEL,
  getDefaultTranslationConfig,
} from '../defaults.js';

describe('defaults config', () => {
  describe('TOP_RECOMMENDED_MODEL', () => {
    it('should be defined with required properties', () => {
      expect(TOP_RECOMMENDED_MODEL).toBeDefined();
      expect(TOP_RECOMMENDED_MODEL.id).toBeDefined();
      expect(TOP_RECOMMENDED_MODEL.provider).toBeDefined();
      expect(TOP_RECOMMENDED_MODEL.model).toBeDefined();
      expect(TOP_RECOMMENDED_MODEL.label).toBeDefined();
    });

    it('should correspond to a valid, non-deprecated model in PROVIDER_CONFIGS', () => {
      const providerConfig = PROVIDER_CONFIGS[TOP_RECOMMENDED_MODEL.provider];
      expect(providerConfig).toBeDefined();

      const matchedModel = providerConfig.models.find((m) => m.id === TOP_RECOMMENDED_MODEL.id);
      expect(matchedModel).toBeDefined();
      expect(matchedModel.deprecated).toBeFalsy();
      expect(matchedModel.model).toBe(TOP_RECOMMENDED_MODEL.model);
    });
  });

  describe('getDefaultTranslationConfig', () => {
    it('should return a complete configuration object using TOP_RECOMMENDED_MODEL', () => {
      const config = getDefaultTranslationConfig();

      expect(config).toBeDefined();
      expect(config.sourceLang).toBe('ja');
      expect(config.targetLang).toBe('en');
      expect(config.updateGlossary).toBe(true);
      expect(config.postEdit).toBe(false);
      expect(config.mode).toBe('simple');

      // Check stages are wired to TOP_RECOMMENDED_MODEL
      expect(config.llm).toBeDefined();
      expect(config.llm.glossaryGenerate).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.glossaryUpdate).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.textChunking).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.translation).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.fallback).toBe(TOP_RECOMMENDED_MODEL.id);
      expect(config.llm.postEdit).toBeNull();

      // Check text segmentation defaults
      expect(config.textSegmentation).toEqual({
        method: 'chunk',
        chunkSize: 2000,
        overlapCount: 10,
        targetSize: 'medium',
      });
    });

    it('should return a fresh copy on every call', () => {
      const config1 = getDefaultTranslationConfig();
      const config2 = getDefaultTranslationConfig();

      expect(config1).not.toBe(config2);
      expect(config1.llm).not.toBe(config2.llm);
      expect(config1.textSegmentation).not.toBe(config2.textSegmentation);
    });
  });
});
