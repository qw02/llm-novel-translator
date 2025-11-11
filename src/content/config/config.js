/**
 * Configuration validation (stub for now)
 */
import { LANGS } from "../../common/languages.js";

export function validateConfig() {
  console.log('[Config] Validating configuration...');

  // For now, return hardcoded config
  const config = {
    llm: {
      glossaryGenerate: '99-1',
      glossaryUpdate: '99-2',
      textChunking: '99-3',
      translation: '99-4',
      postEdit: '99-5',
    },

    updateGlossary: true,
    glossaryChunkSize: 2000,

    textSegmentation: {
      method: 'chunk', // other values: 'single', 'entire'
      chunkSize: 1500, // These keys depend on the method, if it's single then nothing else is needed for example.
      overlapCount: 10,
    },

    translation: {
      // Language specific settings
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

  // Future: Validate API keys, check language detection, etc.

  console.log('[Config] Configuration:', config);
  return config;
}

function getName(code) {
  return LANGS[code] || code;
}
