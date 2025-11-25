/**
 * @typedef {Object} ParagraphData
 * @property {string} id
 *   Unique identifier for this paragraph within this page.
 *   Recommended: a CSS class name generated via makeParagraphId().
 *   The adapter *may* attach it to a DOM element (e.g. element.classList.add(id)),
 *   but it can also be purely logical if replaceText() uses only ordering.
 *
 * @property {number} index
 *   Zero-based order of this paragraph in the original reading sequence.
 *   This must be consistent within a single extractText() call, but does not
 *   need to be persisted across navigation.
 *
 * @property {string} text
 *   Raw text content to translate.
 */

/**
 * @typedef {Object} TranslatedParagraph
 * @property {string} id
 *   Must be copied from the corresponding ParagraphData.id.
 *
 * @property {number} index
 *   Copied from ParagraphData.index for convenience.
 *
 * @property {string} text
 *   Original text.
 *
 * @property {string} translatedText
 *   Translated text.
 */

/**
 * @typedef {Object} DomainReplaceConfig
 * @property {string}  [fontFamily]
 *   Preferred font stack for translated text (if the domain chooses to use it).
 *
 * @property {number}  [fontSizePercent]
 *   Size multiplier such as 100 (=unchanged), 110 (=+10%), etc.
 *   Each domain decides how to interpret and apply this (e.g. multiply current
 *   font-size, or apply a fixed formula).
 **
 * @property {boolean} [showOriginal]
 *   Whether the user requested some form of "show original" behaviour.
 *   The exact UX is entirely domain-specific; the base class makes no assumptions.
 *
 * @property {Object<string, any>} [site]
 *   Optional site-specific options or feature flags.
 */

/**
 * Base class for site-specific domain adapters.
 *
 * Responsibilities of a subclass:
 *  - Decide what counts as a "paragraph" for that site (each <p>, split by <br>, etc.).
 *  - Implement extractText() to return ParagraphData[].
 *  - Implement replaceText() to write translated text back into the page,
 *    including any styling and original-text behaviour the site needs.
 *  - Provide getId() and getSeriesId() for glossary key construction.
 *
 * What this base class provides:
 *  - Shared naming scheme for paragraph identifiers via makeParagraphId().
 *  - Helper to find or inject paragraph ids on DOM elements via
 *    ensureElementParagraphId().
 *
 * The base class does *not*:
 *  - Select DOM nodes.
 *  - Apply styling.
 *  - Implement "show original" behaviour.
 * Any of that is strictly the responsibility of subclasses.
 */
export class DomainAdapter {
  /**
   * Prefix for all paragraph id class names used across the extension.
   * Subclasses should not change this.
   */
  static PARAGRAPH_CLASS_PREFIX = 'tl_ext';

  /**
   * URL patterns this adapter matches.
   *
   * Used by the registry to select an adapter for a given location.
   * Example patterns:
   *   "https://*.example.com/*"
   *   "file:///C:/path/to/test-page.html"
   *
   * Each subclass must supply its own list.
   * @type {string[]}
   */
  static matchPatterns = [];

  /**
   * Return a short, stable identifier for this adapter.
   *
   * This must be unique among all adapters.
   * Used as part of the series-specific glossary key:
   *   glossary_${adapterId}_${seriesId}_${langPair}
   *
   * @returns {string}
   */
  getId() {
    throw new Error('DomainAdapter.getId() must be implemented by a subclass');
  }

  /**
   * Return a stable identifier for the current series on this site.
   *
   * The representation is up to the adapter (slug from URL, DOM title,
   * hash of the URL, etc.), but for a given series it should remain
   * the same across chapters and reloads for consistent glossary keys.
   *
   * @returns {string}
   */
  getSeriesId() {
    throw new Error('DomainAdapter.getSeriesId() must be implemented by a subclass');
  }

  /**
   * Extract logical paragraphs from the current document.
   *
   * A paragraph here is a translation unit, not necessarily a <p> element.
   * It may correspond to:
   *   - one DOM node,
   *   - a group of nodes,
   *   - a segment of text split by <br>,
   *   - text extracted from an image via OCR,
   *   - etc.
   *
   * Requirements:
   *  - Each returned ParagraphData.id must be unique within the page.
   *  - Calls should be idempotent with respect to page layout:
   *    subsequent calls must not change the visible layout. Injecting
   *    missing id classes on first call is fine.
   *
   * The base class does not implement this because the definition of
   * "paragraph" and the selection logic are entirely site-specific.
   *
   * @returns {ParagraphData[]}
   */
  extractText() {
    throw new Error('DomainAdapter.extractText() must be implemented by a subclass');
  }

  /**
   * Write translated text back into the page, using unique classes set by extractor
   *
   * Can be overridden by domain specific logic. It may:
   *  - Replace text content in-place.
   *  - Insert new elements and leave the original untouched.
   *  - Ignore showOriginal for sites that do not support it.
   *  - Implement hover tooltips, floating panels, hidden <p> elements, etc.
   *  - Apply font and size changes in any manner that makes sense
   *    for the layout and CSS of that site.
   *
   * The pipeline guarantees that:
   *  - Every item corresponds to a ParagraphData returned by extractText().
   *  - item.translatedText is present and valid.
   *
   * @param {import('./DomainAdapter.js').TranslatedParagraph[]} items
   * @param {import('./DomainAdapter.js').DomainReplaceConfig} [config]
   * @returns {void}
   */
  replaceText(items, config) {
    for (const item of items) {
      if (!item.translatedText) {
        continue
      }

      const selector = '.' + CSS.escape(item.id);
      const el = document.querySelector(selector);
      if (!el) {
        continue;
      }

      el.textContent = item.translatedText;
    }
  }

  /**
   * Generate an opaque paragraph id suitable for use as a CSS class.
   *
   * The default implementation uses the global PARAGRAPH_CLASS_PREFIX and a
   * zero-padded numeric suffix derived from the provided index:
   *
   *   makeParagraphId(0)  → "tl_ext_00000"
   *   makeParagraphId(12) → "tl_ext_00012"
   *
   * @param {number} index
   * @returns {string}
   */
  makeParagraphId(index) {
    const prefix = /** @type {typeof DomainAdapter} */ (this.constructor)
      .PARAGRAPH_CLASS_PREFIX;
    const suffix = String(index).padStart(5, '0');
    return `${prefix}${suffix}`;
  }

  /**
   * Look for an existing paragraph id on a DOM element, using the shared
   * PARAGRAPH_CLASS_PREFIX.
   *
   * If none is found and injectIfMissing is true, a new id is generated
   * using makeParagraphId(index), added as a class name, and returned.
   *
   * If injectIfMissing is false and none is found, null is returned.
   *
   * This helper is optional; adapters may choose a different strategy.
   *
   * @param {Element} element
   * @param {number} index
   * @param {{ injectIfMissing?: boolean }} [options]
   * @returns {string | null}
   */
  ensureElementParagraphId(element, index, options = {}) {
    const { injectIfMissing = true } = options;
    const prefix = /** @type {typeof DomainAdapter} */ (this.constructor)
      .PARAGRAPH_CLASS_PREFIX;

    const existing = Array.from(element.classList).find((cls) =>
      cls.startsWith(prefix),
    );
    if (existing) {
      return existing;
    }

    if (!injectIfMissing) {
      return null;
    }

    const id = this.makeParagraphId(index);
    element.classList.add(id);
    return id;
  }
}
