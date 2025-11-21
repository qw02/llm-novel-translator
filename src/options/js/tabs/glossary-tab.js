import { GlossaryKeyService, GlossaryRepository } from '../../../common/glossary-store.js';
import { GlossaryEditor } from '../../../common/glossary-ui.js';

class GlossaryTabController {
  constructor() {
    this.tabId = 'glossary';
    this.root = null;
    this.isInitialized = false;
    this.currentEditor = null;
  }

  async onShow() {
    if (!this.isInitialized) {
      // CHANGE: Target the inner container, not the whole tab
      this.root = document.getElementById('glossary-root');
      this.initLayout();
      this.isInitialized = true;
    }
    await this.renderExplorer();
  }

  initLayout() {
    this.root.innerHTML = `
      <div id="glossary-explorer" class="glossary-view">
        <h3>Managed Glossaries</h3>
        <div class="glossary-actions">
          <!-- Potentially add 'Create Global' button here -->
        </div>
        <div id="glossary-tree" class="glossary-tree">Loading...</div>
      </div>
      <div id="glossary-edit-container" class="glossary-view" style="display:none;">
        <button id="glossary-back-btn" class="secondary-btn">← Back to List</button>
        <div id="glossary-editor-mount"></div>
      </div>
    `;

    this.root.querySelector('#glossary-back-btn').onclick = () => {
      this.toggleView('explorer');
    };
  }

  toggleView(viewName) {
    const explorer = this.root.querySelector('#glossary-explorer');
    const editor = this.root.querySelector('#glossary-edit-container');

    if (viewName === 'explorer') {
      explorer.style.display = 'block';
      editor.style.display = 'none';
      this.renderExplorer(); // Refresh list
    } else {
      explorer.style.display = 'none';
      editor.style.display = 'block';
    }
  }

  async renderExplorer() {
    const treeContainer = this.root.querySelector('#glossary-tree');
    const items = await GlossaryRepository.scanAll();

    // Grouping Logic
    const domainMap = {};
    const globals = [];

    items.forEach(item => {
      if (item.type === 'global') {
        globals.push(item);
      } else {
        if (!domainMap[item.domainId]) domainMap[item.domainId] = {};
        if (!domainMap[item.domainId][item.seriesId]) domainMap[item.domainId][item.seriesId] = [];
        domainMap[item.domainId][item.seriesId].push(item);
      }
    });

    let html = `<div class="tree-section"><h4>Global Glossaries</h4><ul>`;
    globals.forEach(g => {
      html += `<li><a href="#" class="edit-link" data-key="${g.originalKey}">${g.sourceLang} -> ${g.targetLang}</a></li>`;
    });
    html += `</ul></div>`;

    html += `<div class="tree-section"><h4>Series Glossaries</h4>`;
    for (const [domain, seriesMap] of Object.entries(domainMap)) {
      html += `<​details><summary>${domain}</summary><div class="tree-indent">`;
      for (const [series, variants] of Object.entries(seriesMap)) {
        html += `<​details><summary>${series}</summary><ul class="tree-indent">`;
        variants.forEach(v => {
          html += `
            <li>
              <a href="#" class="edit-link" data-key="${v.originalKey}">${v.sourceLang} -> ${v.targetLang}</a>
              <a href="#" class="delete-link" data-key="${v.originalKey}" style="color:red; margin-left:10px; font-size: 0.8em;">[Del]</a>
            </li>`;
        });
        html += `</ul><​/details>`;
      }
      html += `</div><​/details>`;
    }
    html += `</div>`;

    treeContainer.innerHTML = html;

    // Bind clicks
    treeContainer.querySelectorAll('.edit-link').forEach(a => {
      a.onclick = (e) => {
        e.preventDefault();
        this.openEditor(a.dataset.key);
      };
    });

    treeContainer.querySelectorAll('.delete-link').forEach(a => {
      a.onclick = async (e) => {
        e.preventDefault();
        if (confirm('Permanently delete this glossary?')) {
          await GlossaryRepository.delete(a.dataset.key);
          this.renderExplorer();
        }
      };
    });
  }

  async openEditor(key) {
    const meta = GlossaryKeyService.parseKey(key); // Re-parse to get details

    // NOTE: In Options page, we treat "Series" and "Global" slightly differently.
    // If the user clicks a Series key, we might want to load the corresponding Global key too,
    // just like the content script does.

    // Construct keys
    const seriesKey = key;
    const globalKey = GlossaryKeyService.buildGlobalKey(meta.sourceLang, meta.targetLang);

    const [seriesData, globalData] = await Promise.all([
      GlossaryRepository.load(seriesKey),
      GlossaryRepository.load(globalKey)
    ]);

    const mountPoint = this.root.querySelector('#glossary-editor-mount');
    mountPoint.innerHTML = ''; // clear previous

    const editor = new GlossaryEditor(mountPoint, {
      onSave: async (newSeries, newGlobal) => {
        // In options page, we save what we loaded.
        // Note: If the user selected a "Global" key initially, seriesKey might be the global key.
        // We should handle that logic.

        if (meta.type === 'global') {
          // If we opened a global file directly, seriesData is actually the global file
          // and we likely don't have a "series" file to save.
          // To keep the UI generic, let's just save based on the keys we derived.
          await GlossaryRepository.save(globalKey, newGlobal);
        } else {
          await GlossaryRepository.save(seriesKey, newSeries);
          await GlossaryRepository.save(globalKey, newGlobal);
        }
      },
      onClose: () => {
        this.toggleView('explorer');
      }
    });

    editor.render(
      meta.type === 'global' ? { entries: [] } : seriesData, // Hide series data if editing global only
      meta.type === 'global' ? seriesData : globalData, // If global mode, the loaded data is put here
      {
        title: meta.type === 'global' ? 'Global Glossary' : 'Series Glossary',
        subtitle: `${meta.sourceLang} -> ${meta.targetLang}`
      }
    );

    this.toggleView('editor');
  }
}

export const glossaryTabController = new GlossaryTabController();
