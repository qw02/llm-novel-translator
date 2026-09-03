export class GlossaryEditor {
  /**
   * @param {HTMLElement} container - The DOM element to mount into (ShadowRoot or Div)
   * @param {Object} options
   * @param {Function} options.onSave - (seriesData, globalData) => Promise<void>
   * @param {Function} options.onClose - () => void
   */
  constructor(container, options) {
    this.container = container;
    this.options = options;

    // State
    this.seriesData = { entries: [] };
    this.globalData = { entries: [] };
    this.activeTab = 'series'; // 'series' | 'global'
    this.meta = { title: 'Dictionary Editor' }; // Display info
    this.expandedEntries = new Set(); // Track expanded state per entry index or id

    // References to internal elements for quick updates
    this.elements = {};
  }

  /**
   * Initialize and render the editor with data.
   * @param {Object} seriesData
   * @param {Object} globalData
   * @param {Object} meta - { title, subtitle, initialTab, hideSeriesTab }
   */
  render(seriesData, globalData, meta) {
    this.seriesData = JSON.parse(JSON.stringify(seriesData || { entries: [] }));
    this.globalData = JSON.parse(JSON.stringify(globalData || { entries: [] }));
    this.meta = meta || this.meta;

    // 1. Set Initial Tab State
    if (this.meta.initialTab) {
      this.activeTab = this.meta.initialTab;
    } else {
      // Default fallback
      this.activeTab = 'series';
    }

    // 2. Inject Styles (Same as before)
    const styleEl = document.createElement('style');
    styleEl.textContent = this.getStyles();
    this.container.appendChild(styleEl);

    // 3. Determine Tab Visibility
    const hideSeries = this.meta.hideSeriesTab;
    const seriesTabStyle = hideSeries ? 'display: none;' : '';

    // 4. Build Layout
    const wrapper = document.createElement('div');
    wrapper.className = 'dict-editor-wrapper';

    wrapper.innerHTML = `
      <div class="dict-editor-header">
        <div class="dict-header-top">
          <div class="dict-header-left">
            <h2 class="dict-title">${this.meta.title}</h2>
            ${this.meta.subtitle ? `<span class="dict-subtitle">${this.meta.subtitle}</span>` : ''}
          </div>
          <div class="dict-header-right">
            <p>You can manually edit the glossary entries here. The text for each entry in the bottom Definition / Translation area will be passed to the model when any of the keys appear in the raw text.</p>
            <p>The series-specific glossary (only available for some sites) is only used for that particular series, while the global glossary is shared for all translations for that language pair.</p>
          </div>
        </div>
        <div class="dict-toolbar">
          <div class="dict-tabs">
            <button class="dict-tab ${this.activeTab === 'series' ? 'active' : ''}" 
                    data-tab="series" 
                    style="${seriesTabStyle}">Series Glossary</button>
            <button class="dict-tab ${this.activeTab === 'global' ? 'active' : ''}" 
                    data-tab="global">Global Glossary</button>
          </div>
          <div class="dict-editor-controls">
            <input type="text" placeholder="Search..." class="dict-search-input">
          </div>
        </div>
      </div>
            
      <div class="dict-editor-content">
        <!-- Entries go here -->
      </div>
      
      <div class="dict-editor-footer">
         <!-- ... Footer remains same ... -->
         <button class="dict-btn dict-btn-success dict-add-btn">Add Entry</button>
         <div class="dict-footer-actions">
           <button class="dict-btn dict-btn-primary dict-save-btn">Save All</button>
           <button class="dict-btn dict-btn-secondary dict-cancel-btn">Cancel</button>
         </div>
      </div>
    `;

    this.container.appendChild(wrapper);

    // ... (Binding elements logic remains the same) ...
    this.elements = {
      content: wrapper.querySelector('.dict-editor-content'),
      tabs: wrapper.querySelectorAll('.dict-tab'),
      // ... other bindings ...
      searchInput: wrapper.querySelector('.dict-search-input'),
      addBtn: wrapper.querySelector('.dict-add-btn'),
      saveBtn: wrapper.querySelector('.dict-save-btn'),
      cancelBtn: wrapper.querySelector('.dict-cancel-btn'),
    };

    // Initial Draw
    this.refreshEntries();
    this.attachListeners();
  }

  getActiveData() {
    return this.activeTab === 'series' ? this.seriesData : this.globalData;
  }

  refreshEntries() {
    const data = this.getActiveData();
    const container = this.elements.content;
    container.innerHTML = '';

    if (data.entries.length === 0) {
      container.innerHTML = `<div class="dict-empty-state">No entries found. Click "Add Entry" to create one.<br>(If this is incorrect, try checking if the language pair shown above is correct)</div>`;
      return;
    }

    data.entries.forEach((entry, idx) => {
      const row = this.createEntryRow(entry, idx);
      container.appendChild(row);
    });
  }

  createEntryRow(entry, index) {
    const el = document.createElement('div');
    el.className = 'dict-entry';

    const isExpanded = this.expandedEntries.has(index);

    // Keys section
    const keysHtml = entry.keys.map((k, kIdx) => `
      <div class="dict-key-chip" data-kidx="${kIdx}">
        <input type="text" value="${k}" data-idx="${index}" data-kidx="${kIdx}" class="dict-key-input">
        <button class="dict-icon-btn dict-del-key" data-idx="${index}" data-kidx="${kIdx}">×</button>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="dict-entry-header">
        <span class="dict-entry-id">#${index + 1}</span>
        <button class="dict-btn-danger dict-btn-small dict-del-entry" data-idx="${index}">Delete</button>
      </div>
      <div class="dict-keys-wrapper ${isExpanded ? 'is-expanded' : ''}">
        <button class="dict-scroll-btn dict-scroll-left" data-idx="${index}" title="Scroll Left" aria-label="Scroll Left">&lt;</button>
        <div class="dict-keys-container ${isExpanded ? 'expanded' : ''}" data-idx="${index}">
          <div class="dict-keys-scroll-content">
            ${keysHtml}
            <button class="dict-btn-small dict-add-key-btn" data-idx="${index}">+ Key</button>
          </div>
        </div>
        <button class="dict-scroll-btn dict-scroll-right" data-idx="${index}" title="Scroll Right" aria-label="Scroll Right">&gt;</button>
        <button class="dict-expand-btn" data-idx="${index}" title="${isExpanded ? 'Hide Extra Keys' : 'Expand All Keys'}">${isExpanded ? 'Hide' : 'Expand'}</button>
      </div>
      <textarea class="dict-value-input" data-idx="${index}" placeholder="Definition / Translation...">${entry.value || ''}</textarea>
    `;

    // Bind events specifically for this row to avoid complex delegation logic
    el.querySelectorAll('.dict-key-input').forEach(input => {
      input.oninput = (e) => {
        this.getActiveData().entries[index].keys[e.target.dataset.kidx] = e.target.value;
      };
    });

    el.querySelector('.dict-value-input').oninput = (e) => {
      this.getActiveData().entries[index].value = e.target.value;
    };

    el.querySelectorAll('.dict-del-key').forEach(btn => {
      btn.onclick = () => {
        this.getActiveData().entries[index].keys.splice(btn.dataset.kidx, 1);
        this.refreshEntries();
      };
    });

    el.querySelector('.dict-add-key-btn').onclick = () => {
      this.getActiveData().entries[index].keys.push('');
      this.refreshEntries();
    };

    el.querySelector('.dict-del-entry').onclick = () => {
      if(confirm('Delete this entry?')) {
        this.getActiveData().entries.splice(index, 1);
        this.expandedEntries.delete(entry);
        this.refreshEntries();
      }
    };

    // Expand / Hide toggle
    const expandBtn = el.querySelector('.dict-expand-btn');
    expandBtn.onclick = () => {
      if (this.expandedEntries.has(entry)) {
        this.expandedEntries.delete(entry);
      } else {
        this.expandedEntries.add(entry);
      }
      this.refreshEntries();
    };

    // Scroll controls and overflow check
    const scrollContainer = el.querySelector('.dict-keys-container');
    const scrollContent = el.querySelector('.dict-keys-scroll-content');
    const scrollLeftBtn = el.querySelector('.dict-scroll-left');
    const scrollRightBtn = el.querySelector('.dict-scroll-right');

    // Get sorted column left positions relative to scrollContent
    const getColumnOffsets = () => {
      const items = Array.from(scrollContent.children);
      const lefts = new Set();
      items.forEach(item => {
        // item.offsetLeft is relative to scrollContent container
        lefts.add(Math.round(item.offsetLeft));
      });
      return Array.from(lefts).sort((a, b) => a - b);
    };

    const updateScrollToggles = () => {
      if (isExpanded) {
        scrollLeftBtn.style.display = 'none';
        scrollRightBtn.style.display = 'none';
        expandBtn.style.display = 'inline-flex';
        return;
      }
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      const hasOverflow = scrollWidth > clientWidth + 1;

      if (!hasOverflow) {
        scrollLeftBtn.style.display = 'none';
        scrollRightBtn.style.display = 'none';
        expandBtn.style.display = 'none';
      } else {
        scrollLeftBtn.style.display = 'inline-flex';
        scrollRightBtn.style.display = 'inline-flex';
        expandBtn.style.display = 'inline-flex';

        const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
        const currentScroll = scrollContainer.scrollLeft;

        // Stop at ends without looping
        scrollLeftBtn.disabled = currentScroll <= 1;
        scrollRightBtn.disabled = currentScroll >= maxScrollLeft - 1;
      }
    };

    scrollLeftBtn.onclick = () => {
      const currentScroll = scrollContainer.scrollLeft;
      const colOffsets = getColumnOffsets();
      // Snap to previous column that is before currentScroll
      let target = 0;
      for (let i = colOffsets.length - 1; i >= 0; i--) {
        if (colOffsets[i] < currentScroll - 2) {
          target = colOffsets[i];
          break;
        }
      }
      scrollContainer.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      setTimeout(updateScrollToggles, 100);
      setTimeout(updateScrollToggles, 300);
    };

    scrollRightBtn.onclick = () => {
      const currentScroll = scrollContainer.scrollLeft;
      const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
      const colOffsets = getColumnOffsets();
      // Snap to next column that is after currentScroll
      let target = maxScrollLeft;
      for (let i = 0; i < colOffsets.length; i++) {
        if (colOffsets[i] > currentScroll + 2) {
          target = colOffsets[i];
          break;
        }
      }
      scrollContainer.scrollTo({ left: Math.min(maxScrollLeft, target), behavior: 'smooth' });
      setTimeout(updateScrollToggles, 100);
      setTimeout(updateScrollToggles, 300);
    };

    scrollContainer.onscroll = () => {
      updateScrollToggles();
    };

    // Auto-scroll into view when a key input receives focus
    el.querySelectorAll('.dict-key-input').forEach(input => {
      input.addEventListener('focus', () => {
        if (!isExpanded) {
          const chip = input.closest('.dict-key-chip');
          if (chip) {
            const chipLeft = chip.offsetLeft;
            const chipRight = chipLeft + chip.offsetWidth;
            const viewLeft = scrollContainer.scrollLeft;
            const viewRight = viewLeft + scrollContainer.clientWidth;

            if (chipLeft < viewLeft) {
              scrollContainer.scrollTo({ left: chipLeft - 8, behavior: 'smooth' });
            } else if (chipRight > viewRight) {
              scrollContainer.scrollTo({ left: chipRight - scrollContainer.clientWidth + 8, behavior: 'smooth' });
            }
          }
        }
      });
    });

    // Check overflow initially and with ResizeObserver
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        updateScrollToggles();
      });
    } else {
      setTimeout(updateScrollToggles, 0);
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        updateScrollToggles();
      });
      ro.observe(scrollContainer);
    }

    return el;
  }

  attachListeners() {
    // Tab Switching
    this.elements.tabs.forEach(tab => {
      tab.onclick = () => {
        this.elements.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab;
        this.refreshEntries();
      };
    });

    // Add Entry
    this.elements.addBtn.onclick = () => {
      this.getActiveData().entries.push({ keys: [''], value: '' });
      this.refreshEntries();
      // Scroll to bottom
      this.elements.content.scrollTop = this.elements.content.scrollHeight;
    };

    // Save
    this.elements.saveBtn.onclick = async () => {
      this.elements.saveBtn.textContent = 'Saving...';
      this.elements.saveBtn.disabled = true;
      try {
        // Filter out empty keys
        [this.seriesData, this.globalData].forEach(data => {
          data.entries.forEach(e => {
            e.keys = e.keys.filter(k => k.trim() !== '');
          });
        });

        await this.options.onSave(this.seriesData, this.globalData);
        this.options.onClose();
      } catch (e) {
        alert('Error saving: ' + e.message);
        this.elements.saveBtn.textContent = 'Save All';
        this.elements.saveBtn.disabled = false;
      }
    };

    // Cancel
    this.elements.cancelBtn.onclick = () => this.options.onClose();

    // Search
    this.elements.searchInput.oninput = (e) => {
      const term = e.target.value.toLowerCase();
      const rows = this.elements.content.querySelectorAll('.dict-entry');
      rows.forEach((row, idx) => {
        const entry = this.getActiveData().entries[idx];
        const match = entry.keys.some(k => k.toLowerCase().includes(term)) ||
          entry.value.toLowerCase().includes(term);
        row.style.display = match ? 'block' : 'none';
      });
    };
  }

  getStyles() {
    return `
      .dict-editor-wrapper {
        display: flex; flex-direction: column; height: 100%; 
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fff; color: #333;
        box-sizing: border-box;
      }
      .dict-editor-header {
        padding: 10px 16px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
        flex-shrink: 0;
      }
      .dict-header-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 8px;
      }
      .dict-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      .dict-title {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
        color: #1e293b;
        line-height: 1.2;
      }
      .dict-subtitle {
        display: inline-block;
        font-size: 12px;
        font-weight: 600;
        color: #3b82f6;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 4px;
        padding: 2px 7px;
        line-height: 1.3;
      }
      .dict-header-right {
        flex: 1;
        min-width: 280px;
        text-align: left;
      }
      .dict-header-right p {
        margin: 0 0 2px 0;
        font-size: 11px;
        line-height: 1.35;
        color: #64748b;
      }
      .dict-header-right p:last-child {
        margin-bottom: 0;
      }

      .dict-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 4px;
      }
      .dict-tabs {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
      .dict-tab { 
        padding: 5px 12px;
        border: 1px solid #cbd5e1;
        background: #f1f5f9;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        transition: all 0.15s ease;
      }
      .dict-tab:hover {
        background: #e2e8f0;
      }
      .dict-tab.active {
        background: #2563eb;
        border-color: #2563eb;
        color: white;
      }
      
      .dict-editor-controls {
        flex: 1;
        max-width: 360px;
      }
      .dict-search-input {
        width: 100%;
        padding: 5px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        box-sizing: border-box;
        font-size: 12px;
        background: #fff;
        outline: none;
      }
      .dict-search-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
      
      .dict-editor-content {
        flex: 1;
        overflow-y: auto;
        padding: 10px 16px;
        background: #f8fafc;
      }
      
      .dict-entry {
        border: 1px solid #e2e8f0;
        padding: 10px 12px;
        border-radius: 6px;
        margin-bottom: 10px;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      }
      .dict-entry:last-child {
        margin-bottom: 0;
      }
      .dict-entry-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .dict-entry-id {
        font-weight: 700;
        color: #94a3b8;
        font-size: 12px;
      }

      /* Keys row container & controls */
      .dict-keys-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        position: relative;
        width: 100%;
        box-sizing: border-box;
      }
      .dict-keys-container {
        width: 800px;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
        max-height: 68px; /* 2 rows: (28px row + 6px gap)*2 = 62-68px */
        display: flex;
        align-items: flex-start;
      }
      .dict-keys-container::-webkit-scrollbar {
        height: 4px;
      }
      .dict-keys-container::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
      }
      .dict-keys-container.expanded {
        width: 100%;
        max-height: none;
        overflow-x: visible;
        overflow-y: visible;
      }
      .dict-keys-scroll-content {
        display: grid;
        grid-template-rows: 28px 28px;
        grid-auto-flow: column;
        grid-auto-columns: 190px;
        gap: 6px 10px;
        align-items: center;
      }
      .dict-keys-container.expanded .dict-keys-scroll-content {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        width: 100%;
        height: auto;
        gap: 6px 10px;
      }

      .dict-key-chip {
        display: flex;
        align-items: center;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        overflow: hidden;
        height: 28px;
        width: 190px;
        box-sizing: border-box;
      }
      .dict-key-chip:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px #3b82f6;
      }
      .dict-key-input {
        border: none;
        padding: 3px 8px;
        outline: none;
        font-size: 12px;
        min-width: 0;
        flex: 1;
        width: 100%;
        background: transparent;
        box-sizing: border-box;
      }
      .dict-icon-btn {
        border: none;
        background: #f1f5f9;
        cursor: pointer;
        padding: 0 6px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        color: #64748b;
        border-left: 1px solid #e2e8f0;
      }
      .dict-icon-btn:hover {
        background: #fee2e2;
        color: #ef4444;
      }

      /* Scroll buttons */
      .dict-scroll-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f1f5f9;
        color: #334155;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        flex-shrink: 0;
        user-select: none;
        padding: 0;
      }
      .dict-scroll-btn:hover:not(:disabled) {
        background: #e2e8f0;
        border-color: #94a3b8;
      }
      .dict-scroll-btn:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .dict-expand-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        color: #475569;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        flex-shrink: 0;
        padding: 3px 7px;
        height: 24px;
        box-sizing: border-box;
      }
      .dict-expand-btn:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
        color: #1e293b;
      }

      .dict-value-input {
        width: 100%;
        min-height: 48px;
        padding: 6px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        resize: vertical;
        box-sizing: border-box;
        font-size: 12px;
        font-family: inherit;
        outline: none;
      }
      .dict-value-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
      }
      
      .dict-editor-footer {
        padding: 10px 16px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        flex-shrink: 0;
      }
      .dict-footer-actions {
        display: flex;
        gap: 8px;
      }
      
      .dict-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      }
      .dict-btn-small {
        padding: 4px 8px;
        font-size: 12px;
        border-radius: 3px;
        border: none;
        cursor: pointer;
      }
      .dict-add-key-btn {
        height: 28px;
        width: 190px;
        border: 1px dashed #cbd5e1;
        background: #f8fafc;
        color: #475569;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      }
      .dict-keys-container.expanded .dict-add-key-btn {
        width: auto;
        padding: 0 12px;
      }
      .dict-add-key-btn:hover {
        border-color: #3b82f6;
        color: #2563eb;
        background: #eff6ff;
      }
      .dict-btn-primary { background: #007bff; color: white; }
      .dict-btn-secondary { background: #6c757d; color: white; }
      .dict-btn-success { background: #28a745; color: white; }
      .dict-btn-danger { background: #dc3545; color: white; }
      
      .dict-empty-state {
        text-align: center;
        padding: 30px 20px;
        color: #94a3b8;
        font-size: 13px;
        line-height: 1.5;
      }
    `;
  }
}
