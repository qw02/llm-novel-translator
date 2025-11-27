import { DomainAdapter } from '../DomainAdapter.js';
import { TextPreProcessor } from "../../content/TextPreProcessor.js";

export class ShukuAdapter extends DomainAdapter {
  /**
   * @type {string[]}
   */
  static matchPatterns = [
    'https://www.52shuku.net/*_*.html',
    'https://52shuku.net/*_*.html',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'shuku';
  }

  /**
   * Series id from URL
   *
   * @returns {string}
   */
  getSeriesId() {
    const { pathname, hostname } = window.location;
    const segments = pathname.split('/').filter(Boolean);

    try {
      // xxx_1.html
      const data = segments.at(-1);

      // Match everything before the final underscore followed by a number and ".html"
      return data.match(/^(.+)_\d+\.html$/)[1];

    } catch (e) {
      // Fallback: stable-but-generic series id
      return `${hostname}${pathname}`;
    }
  }

  /**
   * @returns {import('../DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    const paragraphs = [];

    const textContainers = document.querySelectorAll('.article-content');

    let index = 0;

    textContainers.forEach(container => {
      const pElements = Array.from(container.querySelectorAll('p'));

      pElements.forEach(p => {
        const processedText = new TextPreProcessor(p.textContent)
          .normalizeText()
          .trim()
          .getText();

        if (processedText) {
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
