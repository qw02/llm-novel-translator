/**
 * Configuration validation (stub for now)
 */
import { LANGS } from "../../common/languages.js";

export function getTranslationConfig() {
  // For now, return hardcoded config
  const config = {
    llm: {
      glossaryGenerate: '4-1',
      glossaryUpdate: '4-1',
      textChunking: '4-1',
      translation: '4-1',
      postEdit: '4-1',
    },

    updateGlossary: false,
    glossaryChunkSize: 3000,

    textSegmentation: {
      method: 'chunk', // other values: 'single', 'entire'

      // These keys depend on the method, if it's single then nothing else is needed for example.
      chunkSize: 1500,
      overlapCount: 10,
    },

    translation: {
      // Language pair specific settings
      narrative: 'auto',
      honorifics: 'preserve',
      nameOrder: 'ja',

      // Standard configs
      contextLines: 5,
    },

    postEdit: false,

    // Translation settings
    sourceLang: 'ja',
    targetLang: 'en',
    customInstruction: "",

    get languagePair() {
      return `${this.sourceLang}_${this.targetLang}`;
    },
    get sourceLangName() {
      return getName(this.sourceLang);
    },
    get targetLangName() {
      return getName(this.targetLang);
    },

    valid: true,
  };

  return config;
}

function getName(code) {
  return LANGS[code] || code;
}
