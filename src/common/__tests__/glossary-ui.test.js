import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlossaryEditor } from '../glossary-ui.js';

describe('GlossaryEditor', () => {
  let container;
  let onSaveMock;
  let onCloseMock;

  beforeEach(() => {
    // Minimal DOM container mock for node environment
    const createdElements = [];
    const makeElement = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        style: {},
        children: [],
        dataset: {},
        innerHTMLValue: '',
        scrollLeft: 0,
        scrollWidth: 1000,
        clientWidth: 800,
        offsetLeft: 0,
        offsetWidth: 190,
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        removeChild(child) {
          const idx = this.children.indexOf(child);
          if (idx >= 0) this.children.splice(idx, 1);
        },
        querySelectorAll(selector) {
          const results = [];
          const traverse = (node) => {
            if (!node || typeof node !== 'object') return;
            if (selector.startsWith('.')) {
              const cls = selector.slice(1);
              if (node.className && node.className.split(' ').includes(cls)) {
                results.push(node);
              }
            } else if (selector.startsWith('#')) {
              if (node.id === selector.slice(1)) results.push(node);
            }
            if (Array.isArray(node.children)) {
              node.children.forEach(traverse);
            }
          };
          traverse(this);
          return results;
        },
        querySelector(selector) {
          return this.querySelectorAll(selector)[0] || null;
        },
        addEventListener() {},
        scrollTo({ left }) {
          this.scrollLeft = left;
        },
        get innerHTML() {
          return this.innerHTMLValue;
        },
        set innerHTML(html) {
          this.innerHTMLValue = html;
        }
      };
      return el;
    };

    container = makeElement('div');
    onSaveMock = vi.fn().mockResolvedValue(undefined);
    onCloseMock = vi.fn();
  });

  it('initializes and maintains correct data references', () => {
    const editor = new GlossaryEditor(container, {
      onSave: onSaveMock,
      onClose: onCloseMock,
    });

    const seriesData = { entries: [{ keys: ['apple', 'ringo'], value: 'Apple fruit' }] };
    const globalData = { entries: [{ keys: ['hello'], value: 'greeting' }] };

    editor.seriesData = seriesData;
    editor.globalData = globalData;
    editor.activeTab = 'series';

    expect(editor.getActiveData()).toBe(seriesData);
    expect(editor.getActiveData().entries[0].keys).toEqual(['apple', 'ringo']);
    expect(editor.getActiveData().entries[0].value).toBe('Apple fruit');

    editor.activeTab = 'global';
    expect(editor.getActiveData()).toBe(globalData);
    expect(editor.getActiveData().entries[0].keys).toEqual(['hello']);
  });

  it('allows mutating keys and values without losing data integrity', () => {
    const editor = new GlossaryEditor(container, {
      onSave: onSaveMock,
      onClose: onCloseMock,
    });

    const seriesData = { entries: [{ keys: ['hero'], value: 'protag' }] };
    const globalData = { entries: [] };

    editor.seriesData = seriesData;
    editor.globalData = globalData;
    editor.activeTab = 'series';

    // Simulate modifying key
    editor.getActiveData().entries[0].keys[0] = 'main hero';
    // Simulate adding key
    editor.getActiveData().entries[0].keys.push('brave one');
    // Simulate updating value
    editor.getActiveData().entries[0].value = 'the main protagonist';

    expect(editor.seriesData.entries[0].keys).toEqual(['main hero', 'brave one']);
    expect(editor.seriesData.entries[0].value).toBe('the main protagonist');
  });

  it('generates expected styles containing widescreen and grid rules', () => {
    const editor = new GlossaryEditor(container, {
      onSave: onSaveMock,
      onClose: onCloseMock,
    });
    const styles = editor.getStyles();

    expect(styles).toContain('.dict-header-right');
    expect(styles).toContain('text-align: left');
    expect(styles).toContain('.dict-toolbar');
    expect(styles).toContain('.dict-keys-wrapper');
    expect(styles).toContain('grid-template-rows: 28px 28px');
    expect(styles).toContain('grid-auto-columns: 190px');
    expect(styles).toContain('.dict-scroll-btn');
    expect(styles).toContain('.dict-expand-btn');
  });
});
