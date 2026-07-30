import { DomainAdapter } from '../DomainAdapter.js';

/**
 * Domain adapter for the local test HTML file.
 *
 * Test page structure:
 *   <!DOCTYPE html>
 *   <html lang="ja">
 *   <head>...</head>
 *   <body>
 *     <p id="p1">...</p>
 *     ...
 *     <p id="p183">...</p>
 *   </body>
 *   </html>
 *
 * For this page we treat each <body > p> as one logical paragraph.
 */
export class LocalFileTestAdapter extends DomainAdapter {
  /**
   * Only match the specific local test file.
   * You can relax this pattern later if needed.
   * @type {string[]}
   */
  static matchPatterns = [
    'file:///C:/Code/JS/BrowserExtensions/llm-translator-extension/test_pages/test-page.html',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'local-file-test';
  }

  /**
   * Series id for the test page.
   * For a real site you could derive this from the URL or DOM.
   * Here we simply use the file name as a stable pseudo-series id.
   *
   * @returns {string}
   */
  getSeriesId() {
    try {
      const url = new URL(window.location.href);
      const segments = url.pathname.split(/[\\/]/).filter(Boolean);
      return segments[segments.length - 1] || 'local-test';
    } catch {
      return 'local-test-series';
    }
  }

  /**
   * Treat each <body > p> as a separate paragraph.
   * Paragraph ids are injected as CSS classes on first call, and reused
   * on subsequent calls.
   *
   * @returns {import('../DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    /** @type {import('../DomainAdapter.js').ParagraphData[]} */
    const paragraphs = [];

    const elements = Array.from(document.querySelectorAll('body > p'));

    let index = 0;
    for (const el of elements) {
      const text = el.innerText.trim();
      if (!text) {
        continue;
      }

      const id = this.ensureElementParagraphId(el, index, { injectIfMissing: true });
      if (!id) {
        // This should not happen with injectIfMissing: true, but guard anyway.
        throw new Error('Failed to assign paragraph id for local test element');
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
   * Simple replacement for the test page:
   *   - Require translatedText to be present.
   *   - Locate the element by the paragraph id class and overwrite its textContent.
   *   - Apply a very straightforward font/size adjustment if provided.
   *
   * No "show original" behaviour is implemented here; the test page is
   * focused on verifying basic extraction and replacement.
   *
   * @param {import('../DomainAdapter.js').TranslatedParagraph[]} items
   * @param {import('../DomainAdapter.js').DomainReplaceConfig} [config]
   *
   */
  replaceText(items, config = {}) {
    for (const item of items) {
      if (!item.translatedText) {
        throw new Error(
          `Translated text is missing for paragraph id "${item.id}" (index ${item.index})`,
        );
      }

      const selector = '.' + CSS.escape(item.id);
      const el = document.querySelector(selector);
      if (!el) {
        // For the test page every paragraph should still exist; warn if not.
        console.warn('[LocalFileTestAdapter] No element found for', selector);
        continue;
      }

      el.textContent = item.translatedText;

      // Optional, very simple styling handling for the test page.
      if (config.fontFamily) {
        el.style.fontFamily = config.fontFamily;
      }

      if (
        typeof config.fontSizePercent === 'number' &&
        !Number.isNaN(config.fontSizePercent)
      ) {
        const current = window.getComputedStyle(el).fontSize;
        const currentPx = parseFloat(current) || 16;
        const factor = config.fontSizePercent / 100;
        const nextPx = currentPx * factor;
        el.style.fontSize = `${nextPx}px`;
      }
    }
  }
}
