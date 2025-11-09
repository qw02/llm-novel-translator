/**
 * Configuration validation (stub for now)
 */

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
    glossaryChunkSize: 4000,

    // Translation settings
    sourceLang: 'ja',
    targetLang: 'en',
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

// BCP-47
const languageNames = {
  "en": "English",
  "es": "Spanish",
  "fr": "French",
  "zh-Hans": "Simplified Chinese",
  "zh-Hant": "Traditional Chinese",
  "ja": "Japanese",
  "ko": "Korean"
};

function getName(code) {
  return languageNames[code] || code;
}
