/**
 * Script types for categorizing languages by their writing system
 */
const ScriptType = {
  CJK: 'cjk',
  LATIN: 'latin',
  CYRILLIC: 'cyrillic',
  THAI: 'thai',
};

/**
 * Map BCP-47 language tags to their script type
 */
const LANG_TO_SCRIPT = {
  'en': ScriptType.LATIN,
  'es': ScriptType.LATIN,
  'fr': ScriptType.LATIN,
  'de': ScriptType.LATIN,
  'it': ScriptType.LATIN,
  'pt': ScriptType.LATIN,
  'nl': ScriptType.LATIN,
  'sv': ScriptType.LATIN,
  'pl': ScriptType.LATIN,
  'tr': ScriptType.LATIN,
  'vi': ScriptType.LATIN,
  'id': ScriptType.LATIN,
  'ru': ScriptType.CYRILLIC,
  'zh-Hans': ScriptType.CJK,
  'zh-Hant': ScriptType.CJK,
  'ja': ScriptType.CJK,
  'ko': ScriptType.CJK,
  'th': ScriptType.THAI,
};

/**
 * Default font stacks by language code
 * Languages not listed here fall back to their script type's default
 */
const DEFAULT_FONTS_BY_LANG = {
  'zh-Hans': '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif',
  'zh-Hant': '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif',
  'ja': '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif',
  'ko': '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  'th': '"Noto Sans Thai", "Tahoma", "Leelawadee UI", sans-serif',
};

/**
 * Default font stacks by script type (fallback for unlisted languages)
 */
const DEFAULT_FONTS_BY_SCRIPT = {
  [ScriptType.LATIN]: '"Noto Sans", "Arial", "Helvetica Neue", sans-serif',
  [ScriptType.CYRILLIC]: '"Noto Sans", "Arial", sans-serif',
  [ScriptType.CJK]: '"Noto Sans CJK", sans-serif',
  [ScriptType.THAI]: '"Noto Sans Thai", "Tahoma", sans-serif',
};

/**
 * Word-breaking CSS properties by script type
 */
const WORD_BREAK_STYLES = {
  [ScriptType.CJK]: {
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  },
  [ScriptType.LATIN]: {
    wordBreak: 'normal',
    overflowWrap: 'normal',
  },
  [ScriptType.CYRILLIC]: {
    wordBreak: 'normal',
    overflowWrap: 'normal',
  },
  [ScriptType.THAI]: {
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  },
};

/**
 * Determine the script type for a given language code
 * @param {string} langCode - BCP-47 language identifier
 * @returns {string} Script type constant
 */
function getScriptType(langCode) {
  return LANG_TO_SCRIPT[langCode] ?? ScriptType.LATIN;
}

/**
 * Get the font family stack for a language
 * @param {string} langCode - BCP-47 language identifier
 * @param {Object|null} userFontPrefs - User-defined font preferences keyed by lang code
 * @returns {string} CSS font-family value
 */
function getFontFamily(langCode, userFontPrefs = null) {
  // User preference takes priority if available
  if (userFontPrefs?.[langCode]) {
    return userFontPrefs[langCode];
  }

  // Language-specific default
  if (DEFAULT_FONTS_BY_LANG[langCode]) {
    return DEFAULT_FONTS_BY_LANG[langCode];
  }

  // Fall back to script-type default
  const scriptType = getScriptType(langCode);
  return DEFAULT_FONTS_BY_SCRIPT[scriptType] ?? DEFAULT_FONTS_BY_SCRIPT[ScriptType.LATIN];
}

/**
 * Get word-breaking CSS properties for a language
 * @param {string} langCode - BCP-47 language identifier
 * @returns {Object} Object with wordBreak and overflowWrap properties
 */
function getWordBreakStyles(langCode) {
  const scriptType = getScriptType(langCode);
  return WORD_BREAK_STYLES[scriptType] ?? WORD_BREAK_STYLES[ScriptType.LATIN];
}

/**
 * Apply language-appropriate CSS styles to all extension-marked elements
 * @param {string} targetLang - BCP-47 language identifier
 * @param {string} cssClass - The CSS class marking extension-injected content
 */
export async function applyCSS(targetLang, cssClass) {
  // ENHANCEMENT: load user font preferences from storage
  // const userFontPrefs = await loadUserFontPreferences();
  const userFontPrefs = null;

  const selector = '.' + CSS.escape(cssClass);
  const elements = document.querySelectorAll(selector);

  if (elements.length === 0) {
    return;
  }

  const { wordBreak, overflowWrap } = getWordBreakStyles(targetLang);
  const fontFamily = getFontFamily(targetLang, userFontPrefs);

  elements.forEach((el) => {
    el.style.wordBreak = wordBreak;
    el.style.overflowWrap = overflowWrap;
    el.style.fontFamily = fontFamily;
  });
}
