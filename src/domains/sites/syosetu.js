import { DomainAdapter } from '../DomainAdapter.js';
import { TextPreProcessor } from "../../content/TextPreProcessor.js";

export class SyosetuAdapter extends DomainAdapter {
  /**
   * @type {string[]}
   */
  static matchPatterns = [
    'https://ncode.syosetu.com/*/*/',
    'https://novel18.syosetu.com/*/*/',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'syosetu';
  }

  /**
   * Series id from URL
   *
   * @returns {string}
   */
  getSeriesId() {
    const { pathname, hostname } = window.location;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return segments[0];
    }

    // Fallback: stable-but-generic series id
    return `${hostname}${pathname}`;
  }

  /**
   * @returns {import('../DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    const paragraphs = [];

    const textContainers = document.querySelectorAll('.js-novel-text');

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

        if (p.id && processedText) {
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
}
