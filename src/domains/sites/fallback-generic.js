import { DomainAdapter } from '../DomainAdapter.js';

/**
 * Fallback adapter used when no site-specific adapter matches.
 *
 * This uses generic heuristics to:
 *   - find the main readable container,
 *   - treat block-level elements (mostly <p>) as paragraphs,
 *   - inject paragraph ids,
 *   - replace their text.
 *
 * It is intentionally conservative: the goal is to "do something reasonable"
 * on unknown sites, not to perfectly match every layout.
 */
export class FallbackGenericAdapter extends DomainAdapter {
  /**
   * No matchPatterns: this adapter is never selected by pattern.
   * The registry uses it explicitly as the fallback when nothing else matches.
   */

  getId() {
    return 'fallback-generic';
  }

  getSeriesId() {
    try {
      const url = new URL(window.location.href);
      const hostname = url.hostname || 'unknown-host';
      const parts = url.pathname.split('/').filter(Boolean);
      const seriesPart = parts.length >= 2 ? parts[0] : 'root';
      return `${hostname}/${seriesPart}`;
    } catch {
      return 'unknown-series';
    }
  }

  /**
   * Heuristic extraction:
   *   1. Find candidate containers (article, main, content divs, body).
   *   2. For each, count "paragraph-like" descendants (p, div, li) with text.
   *   3. Use the container with the highest count.
   *   4. Within that container, use its child paragraphs as ParagraphData.
   *
   * @returns {import('../DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    /** @type {import('../DomainAdapter.js').ParagraphData[]} */
    const paragraphs = [];

    const container = this._findBestContentContainer();
    if (!container) {
      return paragraphs;
    }

    const blocks = this._collectParagraphBlocks(container);

    let index = 0;
    for (const el of blocks) {
      const text = el.innerText.trim();
      if (!text) {
        index += 1;
        continue;
      }

      const id = this.ensureElementParagraphId(el, index, { injectIfMissing: true });
      if (!id) {
        throw new Error('FallbackGenericAdapter: failed to assign paragraph id');
      }

      paragraphs.push({
        id,
        index,
        text,
      });

      index += 1;
    }

    return paragraphs;
  }

  /**
   * Basic in-place replacement:
   *   - Require translatedText.
   *   - Find each paragraph element by its id class and replace its textContent.
   *   - Apply font, font-size, line-height as simple multipliers, if provided.
   *
   * @param {import('../DomainAdapter.js').TranslatedParagraph[]} items
   * @param {import('../DomainAdapter.js').DomainReplaceConfig} [config]
   */
  replaceText(items, config = {}) {
    for (const item of items) {
      if (!item.translatedText) {
        throw new Error(
          `FallbackGenericAdapter: translatedText missing for id="${item.id}" (index ${item.index})`,
        );
      }

      const selector = '.' + CSS.escape(item.id);
      const el = document.querySelector(selector);
      if (!el) {
        console.warn('[FallbackGenericAdapter] No element found for', selector);
        continue;
      }

      el.textContent = item.translatedText;

      // Very simple styling behaviour; each real site adapter can do its own thing.
      if (config.fontFamily) {
        el.style.fontFamily = config.fontFamily;
      }

      if (
        typeof config.fontSizePercent === 'number' &&
        !Number.isNaN(config.fontSizePercent)
      ) {
        this._scaleNumericStyle(el, 'fontSize', config.fontSizePercent);
      }

      if (
        typeof config.lineHeightPercent === 'number' &&
        !Number.isNaN(config.lineHeightPercent)
      ) {
        this._scaleNumericStyle(el, 'lineHeight', config.lineHeightPercent);
      }
    }
  }

  /**
   * Try to pick the most plausible "main content" container.
   * @returns {HTMLElement | null}
   * @private
   */
  _findBestContentContainer() {
    const candidates = Array.from(
      document.querySelectorAll(
        'article, main, [role="main"], .content, #content, .post, .entry, .reader, body',
      ),
    );

    if (!candidates.length) {
      return document.body || null;
    }

    let best = null;
    let bestScore = -1;

    for (const el of candidates) {
      const score = this._scoreContainer(el);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return best || document.body || null;
  }

  /**
   * Score a container based on amount of visible text in paragraph-like elements.
   * @param {Element} container
   * @returns {number}
   * @private
   */
  _scoreContainer(container) {
    const blocks = container.querySelectorAll('p, div, li');
    let score = 0;

    for (const node of blocks) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const text = node.textContent || '';
      const length = text.trim().length;
      if (length > 20) {
        score += length;
      }
    }

    return score;
  }

  /**
   * Collect block-level elements inside a container to treat as paragraphs.
   * @param {Element} container
   * @returns {HTMLElement[]}
   * @private
   */
  _collectParagraphBlocks(container) {
    const allBlocks = Array.from(container.querySelectorAll('p, div, li'));

    // Filter to those with meaningful text.
    return allBlocks.filter((el) => {
      const text = el.innerText.trim();
      if (text.length < 5) return false;

      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;

      return true;
    });
  }

  /**
   * Scale a numeric CSS style like fontSize or lineHeight by a percentage.
   * Interprets the computed style as px; this is a best-effort generic approach.
   *
   * @param {HTMLElement} el
   * @param {'fontSize' | 'lineHeight'} property
   * @param {number} percent
   * @private
   */
  _scaleNumericStyle(el, property, percent) {
    const computed = window.getComputedStyle(el)[property];
    const numeric = parseFloat(computed);
    if (!numeric || Number.isNaN(numeric)) return;

    const factor = percent / 100;
    const next = numeric * factor;
    el.style[property] = `${next}px`;
  }
}
