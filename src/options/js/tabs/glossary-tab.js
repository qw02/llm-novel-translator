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
      html += `<details><summary>${domain}</summary><div class="tree-indent">`;
      for (const [series, variants] of Object.entries(seriesMap)) {
        html += `<details><summary>${series}</summary><ul class="tree-indent">`;
        variants.forEach(v => {
          html += `
            <li>
              <a href="#" class="edit-link" data-key="${v.originalKey}">${v.sourceLang} -> ${v.targetLang}</a>
              <a href="#" class="delete-link" data-key="${v.originalKey}" style="color:red; margin-left:10px; font-size: 0.8em;">[Del]</a>
            </li>`;
        });
        html += `</ul></details>`;
      }
      html += `</div></details>`;
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
    const meta = GlossaryKeyService.parseKey(key);

    // Check if we are in "Global Only" mode
    const isGlobalOnly = meta.type === 'global';

    // Construct keys
    const seriesKey = key;
    const globalKey = GlossaryKeyService.buildGlobalKey(meta.sourceLang, meta.targetLang);


    // If Global Only, we don't need to load a series key,
    // but we need to load the global data.
    // NOTE: If isGlobalOnly is true, 'key' IS the globalKey.
    const loadPromises = [];

    if (isGlobalOnly) {
      loadPromises.push(Promise.resolve({ entries: [] })); // Empty series data
      loadPromises.push(GlossaryRepository.load(key));     // Load the global key user clicked
    } else {
      loadPromises.push(GlossaryRepository.load(seriesKey));
      loadPromises.push(GlossaryRepository.load(globalKey));
    }

    const [seriesData, globalData] = await Promise.all(loadPromises);

    const mountPoint = this.root.querySelector('#glossary-editor-mount');
    mountPoint.innerHTML = '';

    const editor = new GlossaryEditor(mountPoint, {
      onSave: async (newSeries, newGlobal) => {
        if (isGlobalOnly) {
          // Only save the global part
          await GlossaryRepository.save(key, newGlobal);
        } else {
          await GlossaryRepository.save(seriesKey, newSeries);
          await GlossaryRepository.save(globalKey, newGlobal);
        }
      },
      onClose: () => {
        this.toggleView('explorer');
      },
    });

    // RENDER with the new flags
    editor.render(
      seriesData,
      globalData,
      {
        title: isGlobalOnly ? 'Global Glossary Editor' : 'Series Glossary Editor',
        subtitle: `${meta.sourceLang} -> ${meta.targetLang}`,

        // FIX: Set active tab and hide series tab if not needed
        initialTab: isGlobalOnly ? 'global' : 'series',
        hideSeriesTab: isGlobalOnly,
      },
    );

    this.toggleView('editor');
  }
}

export const glossaryTabController = new GlossaryTabController();
