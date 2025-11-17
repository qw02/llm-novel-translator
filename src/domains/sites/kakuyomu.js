import { DomainAdapter } from '../DomainAdapter.js';
import { TextPreProcessor } from "../../content/TextPreProcessor.js";

export class KakuyomuAdapter extends DomainAdapter {
  /**
   * Only match the specific local test file.
   * You can relax this pattern later if needed.
   * @type {string[]}
   */
  static matchPatterns = [
    'https://kakuyomu.jp/works/*/episodes/*',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'kakuyomu';
  }

  /**
   * Series id for the test page.
   * For a real site you could derive this from the URL or DOM.
   * Here we simply use the file name as a stable pseudo-series id.
   *
   * @returns {string}
   */
  getSeriesId() {
    const { pathname, hostname } = window.location;
    const segments = pathname.split('/').filter(Boolean);
    // Expected: ["works", "{series}", "episodes", "{chapter}", ...]
    if (segments.length >= 4 && segments[0] === 'works' && segments[2] === 'episodes') {
      return segments[1]; // "{series}"
    }

    // Slightly more defensive: find "a" anywhere in the path
    const idx = segments.indexOf('works');
    if (idx !== -1 && segments[idx + 1]) {
      return segments[idx + 1];
    }

    // Fallback: stable-but-generic series id
    return `${hostname}${pathname}`;
  }

  /**
   * @returns {import('../DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    const paragraphs = [];

    const textContainers = document.querySelectorAll('.js-episode-body');

    let index = 0;

    textContainers.forEach(container => {
      const pElements = Array.from(container.querySelectorAll('p'));

      pElements.forEach(p => {
        const processedText = new TextPreProcessor(p.textContent)
          .normalizeText()
          .processRubyAnnotations()
          .removeBrTags()
          .removeNonTextChars()
          .trim()
          .getText();

        if (p.id && !p.classList.contains('blank') && processedText) {
          const id = this.ensureElementParagraphId(p, index, { injectIfMissing: true });

          paragraphs.push({
            id: id,
            index: index,
            text: processedText,
          });

          index += 1;
        }
      });
    });

    return paragraphs;
  }

  /**
   * @param {import('../DomainAdapter.js').TranslatedParagraph[]} items
   * @param {import('../DomainAdapter.js').DomainReplaceConfig} [config]
   *
   */
  replaceText(items, config = {}) {
    console.log('writing text to dom')
    console.log(items);
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
