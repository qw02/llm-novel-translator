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
          <h2>${this.meta.title}</h2>
          <span class="dict-subtitle">${this.meta.subtitle || ''}</span>
          <p>You can manually edit the glossary entries here. The text for each entry in the bottom Definition / Translation area will be passed to the model when any of the keys appear in the raw text.</p>
          <p>The series-specific glossary (only available for some sites) is only used for that particular series, while the global glossary is shared for all translations for that language pair.</p>
        </div>
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

    // Keys section
    const keysHtml = entry.keys.map((k, kIdx) => `
      <div class="dict-key-chip">
        <input type="text" value="${k}" data-idx="${index}" data-kidx="${kIdx}" class="dict-key-input">
        <button class="dict-icon-btn dict-del-key" data-idx="${index}" data-kidx="${kIdx}">×</button>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="dict-entry-header">
        <span class="dict-entry-id">#${index + 1}</span>
        <button class="dict-btn-danger dict-btn-small dict-del-entry" data-idx="${index}">Delete</button>
      </div>
      <div class="dict-keys-container">
        ${keysHtml}
        <button class="dict-btn-small dict-add-key-btn" data-idx="${index}">+ Key</button>
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
        this.refreshEntries();
      }
    };

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
        font-family: system-ui, sans-serif; background: #fff; color: #333;
      }
      .dict-editor-header { padding: 15px; border-bottom: 1px solid #eee; background: #f8f9fa; }
      .dict-header-top { margin-bottom: 10px; }
      .dict-header-top h2 { margin: 0; font-size: 18px; }
      .dict-subtitle { font-size: 12px; color: #666; }
      
      .dict-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
      .dict-tab { 
        padding: 8px 16px; border: none; background: #e9ecef; cursor: pointer; border-radius: 4px; font-weight: 500;
      }
      .dict-tab.active { background: #007bff; color: white; }
      
      .dict-editor-content { flex: 1; overflow-y: auto; padding: 15px; background: #fff; }
      
      .dict-entry { border: 1px solid #ddd; padding: 15px; border-radius: 6px; margin-bottom: 15px; background: #fff; }
      .dict-entry-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
      .dict-entry-id { font-weight: bold; color: #888; font-size: 12px; }
      
      .dict-keys-container { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
      .dict-key-chip { display: flex; align-items: center; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
      .dict-key-input { border: none; padding: 5px 8px; outline: none; font-size: 13px; min-width: 80px; }
      .dict-icon-btn { border: none; background: #eee; cursor: pointer; padding: 5px 8px; }
      .dict-icon-btn:hover { background: #ddd; color: red; }
      
      .dict-value-input { width: 100%; min-height: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; box-sizing: border-box; }
      
      .dict-editor-footer { padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: space-between; background: #f8f9fa; }
      .dict-footer-actions { display: flex; gap: 10px; }
      
      .dict-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; }
      .dict-btn-small { padding: 4px 8px; font-size: 12px; border-radius: 3px; border: none; cursor: pointer; }
      .dict-btn-primary { background: #007bff; color: white; }
      .dict-btn-primary { background: #007bff; color: white; }
      .dict-btn-secondary { background: #6c757d; color: white; }
      .dict-btn-success { background: #28a745; color: white; }
      .dict-btn-danger { background: #dc3545; color: white; }
      
      .dict-empty-state { text-align: center; padding: 40px; color: #888; }
      .dict-search-input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;}
    `;
  }
}
