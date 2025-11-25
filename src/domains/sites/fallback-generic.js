import { DomainAdapter } from '../DomainAdapter.js';

export class FallbackGenericAdapter extends DomainAdapter {
  constructor() {
    super();

    /**
     * Map paragraph id → { container: HTMLElement, lineIndex: number }
     * Used only for simple <br>-based blocks.
     * @type {Map<string, { container: HTMLElement, lineIndex: number }>}
     */
    this._brSegments = new Map();

    /**
     * Info per <br>-container so we can rebuild innerHTML.
     * @type {Map<HTMLElement, { totalLines: number, originalLines: string[], translatedLines: string[] }>}
     */
    this._brContainers = new Map();
  }

  getId() {
    return "shared";
  }

  getSeriesId() {
    return "shared";
  }

  /**
   * Use the current selection to extract text paragraphs.
   * @returns {import('./DomainAdapter.js').ParagraphData[]}
   */
  extractText() {
    this._brSegments.clear();
    this._brContainers.clear();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return [];
    }

    const range = sel.getRangeAt(0);
    const root = this._getRangeRoot(range);
    const blocks = this._collectBlocksWithinRange(root, range);

    /** @type {import('./DomainAdapter.js').ParagraphData[]} */
    const paragraphs = [];
    let index = 0;

    for (const block of blocks) {
      index = this._extractFromBlock(block, paragraphs, index);
    }

    return paragraphs;
  }

  /**
   * Custom replaceText that:
   *  - Handles simple <br> containers from _brSegments / _brContainers.
   *  - Delegates everything else to the base class (per-element classes).
   *
   * @param {import('./DomainAdapter.js').TranslatedParagraph[]} items
   * @param {import('./DomainAdapter.js').DomainReplaceConfig} [config]
   */
  replaceText(items, config) {
    /** @type {import('./DomainAdapter.js').TranslatedParagraph[]} */
    const itemsForBase = [];

    for (const item of items) {
      if (!item.translatedText) {
        // Treat empty string as "no translation", fall back to original.
        continue;
      }

      const brMeta = this._brSegments.get(item.id);
      if (brMeta) {
        const info = this._brContainers.get(brMeta.container);
        if (!info) {
          continue;
        }
        info.translatedLines[brMeta.lineIndex] = item.translatedText;
      } else {
        itemsForBase.push(item);
      }
    }

    // Commit updates for <br>-based containers.
    for (const [container, info] of this._brContainers.entries()) {
      const finalLines = info.translatedLines.map((line, i) => {
        if (line && line.length > 0) {
          return line;
        }
        // No translation provided: keep original text.
        return info.originalLines[i] || '';
      });

      const safeHtml = finalLines
        .map((line) => this._escapeHtml(line))
        .join('<br>');

      container.innerHTML = safeHtml;
    }

    // Use the base-class logic for span-based and plain-block paragraphs.
    if (itemsForBase.length > 0) {
      super.replaceText(itemsForBase, config);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Extraction helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Decide how to extract paragraphs from one block element.
   *
   * @param {HTMLElement} block
   * @param {import('./DomainAdapter.js').ParagraphData[]} out
   * @param {number} startIndex
   * @returns {number} new index
   */
  _extractFromBlock(block, out, startIndex) {
    // Case 1: span-per-line layout → one ParagraphData per <span>.
    if (this._isSpanLineLayout(block)) {
      return this._extractFromSpanBlock(block, out, startIndex);
    }

    // Case 2: simple text + <br> layout → one ParagraphData per <br>-line.
    if (this._isSimpleBrBlock(block)) {
      return this._extractFromSimpleBrBlock(block, out, startIndex);
    }

    // Fallback: treat whole block as one paragraph.
    const raw = block.textContent || '';
    const text = this._normalizeText(raw);
    if (!text) {
      return startIndex;
    }

    const id = this.ensureElementParagraphId(block, startIndex, {
      injectIfMissing: true,
    });

    out.push({
      id,
      index: startIndex,
      text,
    });

    return startIndex + 1;
  }

  /**
   * Heuristic: does this block look like a "many span lines + <br>" layout?
   *
   * @param {HTMLElement} block
   * @returns {boolean}
   */
  _isSpanLineLayout(block) {
    const spans = Array.from(block.querySelectorAll('span'));

    const meaningful = spans.filter((sp) => {
      const txt = (sp.textContent || '').trim();
      return txt.length > 0;
    });

    // Require at least a few spans to avoid over-triggering.
    if (meaningful.length < 3) {
      return false;
    }

    // And at least one <br> in the block to match your example layout.
    if (!block.querySelector('br')) {
      return false;
    }

    return true;
  }

  /**
   * Extract paragraphs from a span-per-line block.
   * Each <span> becomes one ParagraphData, with a unique class attached.
   *
   * @param {HTMLElement} block
   * @param {import('./DomainAdapter.js').ParagraphData[]} out
   * @param {number} startIndex
   * @returns {number}
   */
  _extractFromSpanBlock(block, out, startIndex) {
    const spans = Array.from(block.querySelectorAll('span'));
    let index = startIndex;

    for (const span of spans) {
      const raw = span.textContent || '';
      const text = this._normalizeText(raw);
      if (!text) {
        continue;
      }

      const id = this.ensureElementParagraphId(span, index, {
        injectIfMissing: true,
      });

      out.push({
        id,
        index,
        text,
      });

      index += 1;
    }

    return index;
  }

  /**
   * Heuristic: block contains only text nodes and <br> children.
   *
   * @param {HTMLElement} block
   * @returns {boolean}
   */
  _isSimpleBrBlock(block) {
    if (!block.querySelector('br')) {
      return false;
    }

    const children = Array.from(block.childNodes);

    return children.every((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return true;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {HTMLElement} */ (node);
        return el.tagName === 'BR';
      }
      return false;
    });
  }

  /**
   * Extract one ParagraphData per <br>-separated line,
   * and remember how to rebuild the container later.
   *
   * @param {HTMLElement} block
   * @param {import('./DomainAdapter.js').ParagraphData[]} out
   * @param {number} startIndex
   * @returns {number}
   */
  _extractFromSimpleBrBlock(block, out, startIndex) {
    const html = block.innerHTML;
    const fragments = html.split(/<br[^>]*>/i);

    const totalLines = fragments.length;
    const originalLines = new Array(totalLines);
    const translatedLines = new Array(totalLines).fill('');

    this._brContainers.set(block, {
      totalLines,
      originalLines,
      translatedLines,
    });

    let index = startIndex;

    for (let lineIndex = 0; lineIndex < fragments.length; lineIndex += 1) {
      const frag = fragments[lineIndex];
      const tmp = document.createElement('div');
      tmp.innerHTML = frag;
      const raw = tmp.textContent || '';
      const text = this._normalizeText(raw);

      originalLines[lineIndex] = text;

      if (!text) {
        continue;
      }

      const id = this.makeParagraphId(index);

      this._brSegments.set(id, {
        container: block,
        lineIndex,
      });

      out.push({
        id,
        index,
        text,
      });

      index += 1;
    }

    return index;
  }

  // ──────────────────────────────────────────────────────────
  // Shared helpers
  // ──────────────────────────────────────────────────────────

  _getRangeRoot(range) {
    let root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
      root = root.parentElement || document.body;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) {
      return document.body;
    }
    return /** @type {HTMLElement} */ (root);
  }

  _collectBlocksWithinRange(root, range) {
    /** @type {HTMLElement[]} */
    const blocks = [];
    /** @type {Set<HTMLElement>} */
    const seen = new Set();

    const BLOCK_TAGS = new Set([
      'P',
      'DIV',
      'LI',
      'TD',
      'TH',
      'BLOCKQUOTE',
      'PRE',
      'SECTION',
      'ARTICLE',
      'MAIN',
      'ASIDE',
    ]);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!range.intersectsNode(node)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    while (walker.nextNode()) {
      const textNode = /** @type {Text} */ (walker.currentNode);
      let el = textNode.parentElement;

      while (el && el !== document.body) {
        if (BLOCK_TAGS.has(el.tagName)) {
          if (!seen.has(el)) {
            seen.add(el);
            blocks.push(el);
          }
          break;
        }
        el = el.parentElement;
      }
    }

    return blocks;
  }

  _normalizeText(raw) {
    return raw
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  _escapeHtml(str) {
    return str.replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return ch;
      }
    });
  }
}
