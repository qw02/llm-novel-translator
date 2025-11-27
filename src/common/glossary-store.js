import { MSG_TYPE } from "./messaging.js";

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
   * @param {string} key
   * @returns {object|null}
   */
  parseKey: (key) => {
    if (!key.startsWith('glossary_')) return null;

    const parts = key.split('_');

    // Global: glossary, global, lang1, lang2 (4 parts)
    // Series: glossary, domain, series..., lang1, lang2 (5+ parts)
    if (parts.length < 4) return null;

    const targetLang = parts.pop();
    const sourceLang = parts.pop();

    // Global check: ['glossary', 'global']
    if (parts[1] === 'global' && parts.length === 2) {
      return {
        type: 'global',
        sourceLang,
        targetLang,
        originalKey: key,
      };
    }

    // Series check: ['glossary', domain, series...]
    if (parts.length >= 3) {
      const domainId = parts[1];
      const seriesId = parts.slice(2).join('_');

      return {
        type: 'series',
        domainId,
        seriesId,
        sourceLang,
        targetLang,
        originalKey: key,
      };
    }

    return null;
  },
};

/**
 * Repository for Loading and Saving Glossaries.
 */
export const GlossaryRepository = {

  /**
   * Loads a specific glossary by its Series ID.
   *
   * @param {string} seriesId - The unique series identifier.
   * @returns {Promise<{entries: Array}>} - The glossary object (or default empty structure).
   */
  async load(seriesId) {
    const response = await chrome.runtime.sendMessage({
      type: MSG_TYPE.get_glossary,
      seriesId,
    });

    if (response && response._error) {
      throw new Error(response._error);
    }

    // Return the payload directly (BG returns the object or { entries: [] })
    return response;
  },

  /**
   * Saves a glossary object.
   *
   * @param {string} seriesId - The unique series identifier.
   * @param {object} data - The glossary object containing { entries: [...] }
   */
  async save(seriesId, data) {
    // Validation: Ensure we don't save corrupted data to IDB
    if (!data || !Array.isArray(data.entries)) {
      throw new Error('Invalid glossary data structure: missing "entries" array.');
    }

    const response = await chrome.runtime.sendMessage({
      type: MSG_TYPE.save_glossary,
      seriesId,
      glossary: data,
    });

    if (response && response._error) {
      throw new Error(response._error);
    }
  },

  /**
   * Deletes a glossary by its Series ID.
   *
   * @param {string} seriesId
   */
  async delete(seriesId) {
    const response = await chrome.runtime.sendMessage({
      type: MSG_TYPE.delete_glossary,
      seriesId,
    });

    if (!response || !response.ok) {
      throw new Error(response ? response.error : 'Unknown error during deletion');
    }
  },

  /**
   * Retrieves all glossary metadata from the database.
   *
   * @returns {Promise<Array<object>>}
   */
  async scanAll() {
    const response = await chrome.runtime.sendMessage({
      type: MSG_TYPE.scan_glossary_keys,
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || 'Unknown error during scan');
    }

    const rawKeys = response.data || [];

    // Parse into structured objects.
    return rawKeys
      .map(k => GlossaryKeyService.parseKey(k))
      .filter(Boolean);
  },
};
