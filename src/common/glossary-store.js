/**
 * Service for generating and parsing storage keys.
 */
export const GlossaryKeyService = {
  /**
   * @param {string} domain
   * @param {string} series
   * @param {string} srcLang
   * @param {string} tgtLang
   * @returns {string}
   */
  buildSeriesKey: (domain, series, srcLang, tgtLang) => {
    // Matching the logic in dom-adapter.js: glossary_${domain}_${series}_${src}_${tgt}
    return `glossary_${domain}_${series}_${srcLang}_${tgtLang}`;
  },

  /**
   * @param {string} srcLang
   * @param {string} tgtLang
   * @returns {string}
   */
  buildGlobalKey: (srcLang, tgtLang) => {
    return `glossary_global_${srcLang}_${tgtLang}`;
  },

  /**
   * Parses a raw storage key into metadata.
   * Robustly handles keys where domain/series might contain underscores,
   * relying on the fixed structure of the prefix and the language suffix.
   * @param {string} key
   */
  parseKey: (key) => {
    if (!key.startsWith('glossary_')) return null;

    // Split by underscore
    const parts = key.split('_');

    // Minimum parts needed:
    // Global: glossary, global, lang1, lang2 (4 parts)
    // Series: glossary, domain, series, lang1, lang2 (5 parts)
    if (parts.length < 4) return null;

    // Extract languages from the tail (last 2 parts)
    // We assume languages don't contain underscores (BCP-47 uses hyphens, e.g. zh-Hans)
    const targetLang = parts.pop();
    const sourceLang = parts.pop();

    // What remains is the "identity" part
    // [ 'glossary', 'global' ] OR [ 'glossary', 'domain', 'series', ... ]

    // Check for Global
    if (parts[1] === 'global' && parts.length === 2) {
      return {
        type: 'global',
        sourceLang,
        targetLang,
        originalKey: key
      };
    }

    // Check for Series
    // parts is now ['glossary', 'domain', 'series'...]
    // We assume parts[1] is domain. Everything after that (joined) is series.
    if (parts.length >= 3) {
      const domainId = parts[1];
      // Re-join the series ID in case it contained underscores originally
      const seriesId = parts.slice(2).join('_');

      return {
        type: 'series',
        domainId,
        seriesId,
        sourceLang,
        targetLang,
        originalKey: key
      };
    }

    return null;
  }
};

/**
 * Repository for Loading and Saving Glossaries.
 */
export const GlossaryRepository = {
  /**
   * Loads a specific glossary key. Returns default structure if empty.
   * @param {string} key
   * @returns {Promise<{entries: Array}>}
   */
  async load(key) {
    const result = await chrome.storage.local.get({ [key]: { entries: [] } });
    return result[key];
  },

  /**
   * Saves a glossary.
   * @param {string} key
   * @param {object} data
   */
  async save(key, data) {
    // Basic validation to ensure we don't save corrupted data
    if (!data || !Array.isArray(data.entries)) {
      throw new Error('Invalid glossary data structure');
    }
    await chrome.storage.local.set({ [key]: data });
  },

  /**
   * Deletes a glossary by key.
   * @param {string} key
   */
  async delete(key) {
    await chrome.storage.local.remove(key);
  },

  /**
   * Scans all local storage for glossary keys.
   * Used by Options Page to list everything.
   */
  async scanAll() {
    const allData = await chrome.storage.local.get(null);
    const keys = Object.keys(allData).filter(k => k.startsWith('glossary_'));

    return keys.map(k => GlossaryKeyService.parseKey(k)).filter(Boolean);
  }
};
