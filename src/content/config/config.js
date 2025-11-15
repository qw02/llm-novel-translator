/**
 * Configuration validation (stub for now)
 */
import { LANGS } from "../../common/languages.js";

export function getTranslationConfig() {
  // For now, return hardcoded config
  const config = {
    llm: {
      glossaryGenerate: '6-3',
      glossaryUpdate: '6-4',
      textChunking: '6-4',
      translation: '6-4',
      postEdit: '6-4',
    },

    updateGlossary: true,
    glossaryChunkSize: 2000,

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

    postEdit: true,

    // Translation settings
    sourceLang: 'ja',
    targetLang: 'en',
    customInstruction: "User Entered Instructions",

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
