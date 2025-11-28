import { DomainAdapter } from '../DomainAdapter.js';
import { TextPreProcessor } from "../../content/TextPreProcessor.js";

export class JjwxcAdapter extends DomainAdapter {
  /**
   * Only match the specific local test file.
   * You can relax this pattern later if needed.
   * @type {string[]}
   */
  static matchPatterns = [
    'https://www.jjwxc.net/onebook.php?novelid=*&chapterid=*',
  ];

  /**
   * Unique adapter id for glossary keys.
   * @returns {string}
   */
  getId() {
    return 'jjwxc';
  }

  /**
   * Series id for the test page.
   * For a real site you could derive this from the URL or DOM.
   * Here we simply use the file name as a stable pseudo-series id.
   *
   * @returns {string}
   */
  getSeriesId() {
    const url = window.location.href;
    const match = url.match(/novelid=(\d+)/);
    return match ? match[1] : "jjwxc_chapter";
  }

  /**
   * Extracts text content from JJWXC novel pages.
   * Handles primary container (div[id^="content_"]) and fallback (.novelbody).
   * @returns {Array<{id: number, index: number, text: string}>}
   */
  extractText() {
    // Attempt primary container first
    let container = document.querySelector('div[id^="content_"]');
    let isPrimaryMode = true;

    if (!container) {
      // Fall back to .novelbody structure
      isPrimaryMode = false;
      container = this.findFallbackContainer();
    }

    if (!container) {
      return [];
    }

    // Store references for replaceText
    this.contentContainer = container;
    this.isPrimaryMode = isPrimaryMode;

    // Extract lines, splitting on <br> elements
    const lines = this.extractLinesFromContainer(container, isPrimaryMode);

    // Store raw segments (including empty lines for positional integrity)
    this.segments = lines;
    this.indexToPosition = new Map();

    const paragraphs = [];
    let index = 0;

    lines.forEach((lineText, position) => {
      const trimmedText = lineText.trim();

      // Only non-empty lines become extractable paragraphs
      if (trimmedText) {
        this.indexToPosition.set(index, position);

        paragraphs.push({
          id: index,
          index: index,
          text: trimmedText,
        });

        index += 1;
      }
    });

    return paragraphs;
  }

  /**
   * Walks container's child nodes, building an array of line strings.
   * Each <br> terminates the current line and starts a new one.
   * @param {Element} container
   * @param {boolean} isPrimaryMode - If true, process <span> pseudo-elements
   * @returns {string[]}
   */
  extractLinesFromContainer(container, isPrimaryMode) {
    const lines = [];
    let currentLine = '';

    container.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Accumulate text node content
        currentLine += node.textContent;
      } else if (node.tagName === 'BR') {
        // Line break: finalize current line, start fresh
        lines.push(currentLine);
        currentLine = '';
      } else if (node.tagName === 'SPAN' && isPrimaryMode) {
        // Primary mode: extract ::before + innerText + ::after
        const beforeText = this.getPseudoElementContent(node, '::before');
        const spanText = node.textContent;
        const afterText = this.getPseudoElementContent(node, '::after');

        currentLine += beforeText + spanText + afterText;
      }
      // Other elements are ignored (matching original behavior)
    });

    // Capture any trailing content after the last <br> (or if no <br> exists)
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Retrieves the computed `content` value of a pseudo-element.
   * @param {Element} element
   * @param {string} pseudo - Either '::before' or '::after'
   * @returns {string}
   */
  getPseudoElementContent(element, pseudo) {
    const computedStyle = window.getComputedStyle(element, pseudo);
    const contentValue = computedStyle?.content;

    // content is 'none' or '""' when not set; otherwise it's quoted
    if (contentValue && contentValue !== 'none' && contentValue !== '""') {
      // Strip surrounding quotes from the content value
      return contentValue.replace(/^['"]|['"]$/g, '');
    }

    return '';
  }

  /**
   * Finds the fallback container: a .novelbody element with exactly one direct div child.
   * @returns {Element|null}
   */
  findFallbackContainer() {
    const novelbodyElements = document.querySelectorAll('.novelbody');

    for (const element of novelbodyElements) {
      const children = Array.from(element.children);
      const divChildren = children.filter((child) => child.tagName === 'DIV');

      // Must have exactly one child, and that child must be a div
      if (divChildren.length === 1 && children.length === 1) {
        return divChildren[0];
      }
    }

    return null;
  }

  /**
   * Replaces extracted text with translated content.
   * @param {Array<{index: number, translatedText: string|null|undefined}>} items
   * @param {object} config
   */
  replaceText(items, config) {
    if (!this.contentContainer) {
      return;
    }

    // Build index -> translatedText lookup, filtering out undefined entries
    const translations = new Map(
      items
        .filter((item) => item.translatedText !== undefined)
        .map((item) => [item.index, item.translatedText]),
    );

    // Clone segments and apply translations at their original positions
    const updatedSegments = [...this.segments];

    for (const [index, position] of this.indexToPosition) {
      const translatedText = translations.get(index);

      if (translatedText !== undefined) {
        if (translatedText === null) {
          // null signals "hide this segment"
          updatedSegments[position] = '';
        } else {
          updatedSegments[position] = translatedText;
        }
      }
    }

    // Rebuild the container: text nodes interleaved with <br> elements
    this.contentContainer.innerHTML = '';
    this.contentContainer.classList.add(DomainAdapter.CSS_EXT_CLASS);

    updatedSegments.forEach((segment, i) => {
      this.contentContainer.appendChild(document.createTextNode(segment));

      // Insert <br> after every segment except the last
      if (i < updatedSegments.length - 1) {
        this.contentContainer.appendChild(document.createElement('br'));
      }
    });
  }
}
