import { DomainAdapter } from '../DomainAdapter.js';

export class BanxiaAdapter extends DomainAdapter {
  constructor() {
    super();
    // Stores all segments from splitting by <br>, including empty strings
    this.segments = [];
    // Maps output index -> position in this.segments
    this.indexToPosition = new Map();
  }
  /**
   * @type {string[]}
   */
  static matchPatterns = [
    'https://www.xbanxia.cc/books/*/*.html',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'banxia';
  }

  /**
   * Series id from URL
   *
   * @returns {string}
   */
  getSeriesId() {
    const { pathname, hostname } = window.location;
    const segments = pathname.split('/').filter(Boolean);

    // ['books', 'series id', 'chapter id']
    if (segments.length >= 3) {
      return segments[1];
    }

    // Fallback
    return `${hostname}${pathname}`;
  }

  extractText() {
    const container = document.getElementById('nr1');
    if (!container) {
      return [];
    }

    // Split by <br>, <br/>, <br /> variants; trim each segment
    const html = container.textContent;
    this.segments = html.split('\n').map(segment => segment.trim());

    const paragraphs = [];
    let index = 0;

    this.segments.forEach((text, position) => {
      // Only non-empty segments go to the pipeline
      if (text) {
        this.indexToPosition.set(index, position);

        paragraphs.push({
          id: index,
          index: index,
          text: text,
        });

        index += 1;
      }
    });

    return paragraphs;
  }

  replaceText(items, config) {
    const container = document.getElementById('nr1');
    if (!container) {
      return;
    }

    // Build index -> translatedText lookup
    const translations = new Map(
      items
        .filter(item => item.translatedText)
        .map(item => [item.index, item.translatedText])
    );

    // Substitute translations into their original positions
    const updatedSegments = [...this.segments];
    for (const [index, position] of this.indexToPosition) {
      const translated = translations.get(index);
      if (translated !== undefined) {
        updatedSegments[position] = translated;
      }
    }

    // Rebuild container with text nodes and <br> elements
    container.innerHTML = '';
    container.classList.add(DomainAdapter.CSS_EXT_CLASS);

    updatedSegments.forEach((segment, i) => {
      container.appendChild(document.createTextNode(segment));
      // Add <br> after each segment except the last
      if (i < updatedSegments.length - 1) {
        container.appendChild(document.createElement('br'));
      }
    });
  }
}
