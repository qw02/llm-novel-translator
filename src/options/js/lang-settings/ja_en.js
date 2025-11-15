/**
 * Language pair specific settings for Japanese → English translation.
 *
 * Exports an object with methods to render UI, apply config, and extract values.
 */

export const ja_en_settings = {
  // Default values for this pair
  defaults: {
    narrative: 'auto',
    honorifics: 'preserve',
    nameOrder: 'ja'
  },

  // Internal references to DOM elements (set during render)
  elements: {
    narrativeSelect: null,
    honorificsSelect: null,
    nameOrderSelect: null
  },

  /**
   * Render the pair-specific UI into the given container.
   * @param {HTMLElement} container - Where to append the settings UI
   * @param {Function} onChange - Callback when any value changes (for marking dirty)
   */
  render(container, onChange) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'pair-settings-ja-en';

    // Narrative person
    const narrativeRow = document.createElement('div');
    narrativeRow.className = 'pair-setting-row';

    const narrativeLabel = document.createElement('label');
    narrativeLabel.setAttribute('for', 'pair-narrative');
    narrativeLabel.textContent = 'Narrative person:';

    const narrativeSelect = document.createElement('select');
    narrativeSelect.id = 'pair-narrative';
    narrativeSelect.innerHTML = `
      <option value="auto">Auto-detect</option>
      <option value="first">First person</option>
      <option value="third">Third person</option>
    `;

    narrativeRow.appendChild(narrativeLabel);
    narrativeRow.appendChild(narrativeSelect);

    // Honorifics handling
    const honorificsRow = document.createElement('div');
    honorificsRow.className = 'pair-setting-row';

    const honorificsLabel = document.createElement('label');
    honorificsLabel.setAttribute('for', 'pair-honorifics');
    honorificsLabel.textContent = 'Honorifics:';

    const honorificsSelect = document.createElement('select');
    honorificsSelect.id = 'pair-honorifics';
    honorificsSelect.innerHTML = `
      <option value="preserve">Preserve (-san, -sama, etc.)</option>
      <option value="remove">Remove</option>
    `;

    honorificsRow.appendChild(honorificsLabel);
    honorificsRow.appendChild(honorificsSelect);

    // Name order
    const nameOrderRow = document.createElement('div');
    nameOrderRow.className = 'pair-setting-row';

    const nameOrderLabel = document.createElement('label');
    nameOrderLabel.setAttribute('for', 'pair-name-order');
    nameOrderLabel.textContent = 'Name order:';

    const nameOrderSelect = document.createElement('select');
    nameOrderSelect.id = 'pair-name-order';
    nameOrderSelect.innerHTML = `
      <option value="ja">Japanese (Family Given)</option>
      <option value="en">English (Given Family)</option>
    `;

    nameOrderRow.appendChild(nameOrderLabel);
    nameOrderRow.appendChild(nameOrderSelect);

    // Assemble
    wrapper.appendChild(narrativeRow);
    wrapper.appendChild(honorificsRow);
    wrapper.appendChild(nameOrderRow);

    container.appendChild(wrapper);

    // Store references
    this.elements.narrativeSelect = narrativeSelect;
    this.elements.honorificsSelect = honorificsSelect;
    this.elements.nameOrderSelect = nameOrderSelect;

    // Attach change listeners
    if (onChange) {
      narrativeSelect.addEventListener('change', onChange);
      honorificsSelect.addEventListener('change', onChange);
      nameOrderSelect.addEventListener('change', onChange);
    }
  },

  /**
   * Apply config values to the UI.
   * @param {Object} translationConfig - The translation sub-config from main config
   */
  applyConfig(translationConfig) {
    const { narrativeSelect, honorificsSelect, nameOrderSelect } = this.elements;

    if (narrativeSelect) {
      narrativeSelect.value = translationConfig.narrative || this.defaults.narrative;
    }

    if (honorificsSelect) {
      honorificsSelect.value = translationConfig.honorifics || this.defaults.honorifics;
    }

    if (nameOrderSelect) {
      nameOrderSelect.value = translationConfig.nameOrder || this.defaults.nameOrder;
    }
  },

  /**
   * Extract current values from the UI.
   * @returns {Object} - Pair-specific config values
   */
  getConfig() {
    const { narrativeSelect, honorificsSelect, nameOrderSelect } = this.elements;

    return {
      narrative: narrativeSelect?.value || this.defaults.narrative,
      honorifics: honorificsSelect?.value || this.defaults.honorifics,
      nameOrder: nameOrderSelect?.value || this.defaults.nameOrder
    };
  },

  /**
   * Cleanup when switching away from this pair (optional).
   */
  cleanup() {
    this.elements.narrativeSelect = null;
    this.elements.honorificsSelect = null;
    this.elements.nameOrderSelect = null;
  }
};