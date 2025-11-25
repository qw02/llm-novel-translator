// ./options/js/tabs/custom-instructions.js

import { LANGS } from '../../../common/languages.js';

// Storage key
const STORAGE_KEY = 'customInstructions';

// Get list of language codes and labels from LANGS
function getLanguageList() {
  return Object.entries(LANGS).map(([code, label]) => ({ code, label }));
}

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export class CustomInstructionsTabController {
  constructor() {
    this.tabId = 'custom-instructions';

    this.root = null;
    this.quickAccessContainer = null;
    this.sourceLangSelect = null;
    this.targetLangSelect = null;
    this.instructionsTextarea = null;
    this.statusElement = null;
    this.saveButton = null;
    this.discardButton = null;
    this.deleteButton = null;

    this.pairSwitchDialog = null;

    // All instructions loaded from storage: { "ja_en": "text...", "es_fr": "text..." }
    this.allInstructions = {};
    this.originalAllInstructions = {};

    // Current pair being edited
    this.currentPairKey = null;
    this.currentText = '';
    this.originalText = '';

    // Pending pair switch (when user clicks quick access or changes selectors with unsaved changes)
    this.pendingPairKey = null;

    // Flag to prevent recursive selector changes during swaps
    this.isSwapping = false;

    this.isInitialized = false;
    this.isDirty = false;
  }

  async onShow() {
    if (!this.isInitialized) {
      this.initDom();
      this.attachListeners();
      this.populateLanguageDropdowns();
      this.isInitialized = true;
    }

    await this.loadAllInstructions();
  }

  initDom() {
    this.root = document.getElementById('tab-custom-instructions');
    this.quickAccessContainer = document.getElementById('custom-instructions-quick-access');
    this.sourceLangSelect = document.getElementById('custom-source-lang');
    this.targetLangSelect = document.getElementById('custom-target-lang');
    this.instructionsTextarea = document.getElementById('custom-instructions-text');
    this.statusElement = document.getElementById('custom-instructions-status');
    this.saveButton = document.getElementById('custom-instructions-save');
    this.discardButton = document.getElementById('custom-instructions-discard');
    this.deleteButton = document.getElementById('custom-instructions-delete');

    this.pairSwitchDialog = document.getElementById('pair-switch-dialog');
  }

  attachListeners() {
    // Language selector changes
    this.sourceLangSelect.addEventListener('change', () => {
      this.onLanguageSelectorChange('source');
    });

    this.targetLangSelect.addEventListener('change', () => {
      this.onLanguageSelectorChange('target');
    });

    // Textarea changes
    this.instructionsTextarea.addEventListener('input', () => {
      this.currentText = this.instructionsTextarea.value;
      this.markDirty();
    });

    // Save button
    this.saveButton.addEventListener('click', async () => {
      await this.save();
    });

    // Discard button
    this.discardButton.addEventListener('click', () => {
      this.discard();
    });

    // Delete button
    this.deleteButton.addEventListener('click', async () => {
      await this.deletePair();
    });

    // Pair switch dialog
    this.pairSwitchDialog.addEventListener('click', (event) => {
      const btn = event.target;
      if (!(btn instanceof HTMLButtonElement)) return;

      const action = btn.dataset.pairAction;
      if (!action) return;

      if (action === 'discard') {
        this.confirmPairSwitch();
      } else if (action === 'cancel') {
        this.cancelPairSwitch();
      }
    });
  }

  populateLanguageDropdowns() {
    const languages = getLanguageList();

    const addOptions = (select) => {
      select.innerHTML = '';
      languages.forEach(({ code, label }) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${label} (${code})`;
        select.appendChild(option);
      });
    };

    addOptions(this.sourceLangSelect);
    addOptions(this.targetLangSelect);
  }

  async loadAllInstructions() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      this.allInstructions = result[STORAGE_KEY] || {};
      this.originalAllInstructions = deepClone(this.allInstructions);

      this.renderQuickAccessButtons();

      // Load the first available pair, or default to first two languages
      const pairs = Object.keys(this.allInstructions);
      if (pairs.length > 0) {
        this.loadPair(pairs[0], false);
      } else {
        // No saved pairs yet, default to first two languages
        const languages = getLanguageList();
        const defaultSource = languages[0].code;
        const defaultTarget = languages[1].code;
        const defaultPairKey = `${defaultSource}_${defaultTarget}`;
        this.loadPair(defaultPairKey, false);
      }

      this.setStatus('', '');
    } catch (error) {
      console.error('[Options] Failed to load custom instructions:', error);
      this.setStatus('Failed to load custom instructions.', 'error');
    }
  }

  renderQuickAccessButtons() {
    this.quickAccessContainer.innerHTML = '';

    const pairs = Object.keys(this.allInstructions);

    if (pairs.length === 0) {
      const p = document.createElement('p');
      p.textContent = 'No custom instructions created yet.';
      p.style.fontStyle = 'italic';
      p.style.color = '#666';
      this.quickAccessContainer.appendChild(p);
      return;
    }

    const label = document.createElement('span');
    label.textContent = 'Quick access: ';
    label.style.marginRight = '0.5rem';
    this.quickAccessContainer.appendChild(label);

    pairs.forEach((pairKey) => {
      const [source, target] = pairKey.split('_');
      const sourceName = LANGS[source] || source;
      const targetName = LANGS[target] || target;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-access-btn';
      btn.textContent = `${sourceName} → ${targetName}`;
      btn.dataset.pairKey = pairKey;

      btn.addEventListener('click', () => {
        this.attemptPairSwitch(pairKey);
      });

      this.quickAccessContainer.appendChild(btn);
    });
  }

  onLanguageSelectorChange(changedSelector) {
    // Prevent recursive changes during swap
    if (this.isSwapping) return;

    const newSource = this.sourceLangSelect.value;
    const newTarget = this.targetLangSelect.value;

    // Check if source and target are now the same
    if (newSource === newTarget) {
      // Auto-swap logic
      this.isSwapping = true;

      if (changedSelector === 'source') {
        // User changed source to match target, so swap target to old source
        const [oldSource, oldTarget] = this.currentPairKey.split('_');
        this.targetLangSelect.value = oldSource;
      } else {
        // User changed target to match source, so swap source to old target
        const [oldSource, oldTarget] = this.currentPairKey.split('_');
        this.sourceLangSelect.value = oldTarget;
      }

      this.isSwapping = false;

      // Now get the swapped pair
      const swappedSource = this.sourceLangSelect.value;
      const swappedTarget = this.targetLangSelect.value;
      const swappedPairKey = `${swappedSource}_${swappedTarget}`;

      // Attempt to switch to the swapped pair
      this.attemptPairSwitch(swappedPairKey);
      return;
    }

    // Normal case: different languages selected
    const pairKey = `${newSource}_${newTarget}`;

    if (pairKey === this.currentPairKey) {
      // No change
      return;
    }

    this.attemptPairSwitch(pairKey);
  }

  attemptPairSwitch(targetPairKey) {
    if (this.isDirty) {
      this.pendingPairKey = targetPairKey;
      this.openPairSwitchDialog();
    } else {
      this.loadPair(targetPairKey, false);
    }
  }

  openPairSwitchDialog() {
    this.pairSwitchDialog.hidden = false;
  }

  closePairSwitchDialog() {
    this.pairSwitchDialog.hidden = true;
    this.pendingPairKey = null;
  }

  confirmPairSwitch() {
    // Discard changes and switch
    this.closePairSwitchDialog();
    if (this.pendingPairKey) {
      this.loadPair(this.pendingPairKey, false);
    }
  }

  cancelPairSwitch() {
    // Stay on current pair
    this.closePairSwitchDialog();

    // Revert selectors to current pair if user changed them
    if (this.currentPairKey) {
      const [source, target] = this.currentPairKey.split('_');
      this.sourceLangSelect.value = source;
      this.targetLangSelect.value = target;
    }
  }

  loadPair(pairKey, markDirty = false) {
    this.currentPairKey = pairKey;
    const [source, target] = pairKey.split('_');

    // Update selectors
    this.sourceLangSelect.value = source;
    this.targetLangSelect.value = target;

    // Load text
    const text = this.allInstructions[pairKey] || '';
    this.currentText = text;
    this.originalText = text;
    this.instructionsTextarea.value = text;

    this.isDirty = markDirty;
    this.setStatus('', '');
  }

  markDirty() {
    this.isDirty = true;
  }

  async save() {
    const pairKey = this.currentPairKey;
    const source = this.sourceLangSelect.value;
    const target = this.targetLangSelect.value;

    // Validation: prevent same source and target
    if (source === target) {
      this.setStatus('Error: Source and target languages must be different.', 'error');
      throw new Error('Cannot save custom instructions: source and target languages are the same');
    }

    const text = this.currentText.trim();

    // Confirmation dialog
    const sourceName = LANGS[source] || source;
    const targetName = LANGS[target] || target;
    const confirmed = confirm(
      `Save custom instructions for ${sourceName} → ${targetName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Update in-memory copy
      if (text) {
        this.allInstructions[pairKey] = text;
      } else {
        // If text is empty, remove the pair
        delete this.allInstructions[pairKey];
      }

      // Save to storage
      await chrome.storage.local.set({
        [STORAGE_KEY]: this.allInstructions
      });

      this.originalAllInstructions = deepClone(this.allInstructions);
      this.originalText = text;
      this.isDirty = false;

      this.renderQuickAccessButtons();
      this.setStatus('Custom instructions saved.', 'success');

      // If we just deleted (empty text), reload to clear UI
      if (!text) {
        await this.loadAllInstructions();
      }
    } catch (error) {
      console.error('[Options] Failed to save custom instructions:', error);
      this.setStatus('Failed to save custom instructions.', 'error');
      throw error;
    }
  }

  discard() {
    // Revert to last saved text
    this.currentText = this.originalText;
    this.instructionsTextarea.value = this.originalText;
    this.isDirty = false;
    this.setStatus('Changes discarded.', 'info');
  }

  async deletePair() {
    const pairKey = this.currentPairKey;

    if (!this.allInstructions[pairKey]) {
      this.setStatus('Nothing to delete for this pair.', 'info');
      return;
    }

    const sourceName = LANGS[this.sourceLangSelect.value] || this.sourceLangSelect.value;
    const targetName = LANGS[this.targetLangSelect.value] || this.targetLangSelect.value;
    const confirmed = confirm(
      `Delete custom instructions for ${sourceName} → ${targetName}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      delete this.allInstructions[pairKey];

      await chrome.storage.local.set({
        [STORAGE_KEY]: this.allInstructions
      });

      this.originalAllInstructions = deepClone(this.allInstructions);
      this.isDirty = false;

      this.setStatus('Custom instructions deleted.', 'success');

      // Reload to update UI
      await this.loadAllInstructions();
    } catch (error) {
      console.error('[Options] Failed to delete custom instructions:', error);
      this.setStatus('Failed to delete custom instructions.', 'error');
    }
  }

  canNavigateAway() {
    return !this.isDirty;
  }

  setStatus(message, type) {
    if (!this.statusElement) return;
    this.statusElement.textContent = message || '';
    this.statusElement.dataset.statusType = type || '';
  }
}

export const customInstructionsTabController = new CustomInstructionsTabController();
