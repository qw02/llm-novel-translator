import { DomainAdapter } from '../DomainAdapter.js';
import { TextPreProcessor } from "../../content/TextPreProcessor.js";

export class AO3Adapter extends DomainAdapter {
  /**
   * Only match the specific local test file.
   * You can relax this pattern later if needed.
   * @type {string[]}
   */
  static matchPatterns = [
    'https://archiveofourown.org/works/*/chapters/*',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'ao3';
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
    // Expected: ["works", "{series}", "chapters", "{chapter}", ...]
    if (segments.length >= 4 && segments[0] === 'works' && segments[2] === 'chapters') {
      return segments[1]; // "{series}"
    }

    // Slightly more defensive: find "works" anywhere in the path
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

    let index = 0;

    document.querySelector('[role="article"]')
      .querySelectorAll('p')
      .forEach(p => {
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
      })


    return paragraphs;
  }
}
