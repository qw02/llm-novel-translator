import { ja_en_settings } from '../lang-settings/ja_en.js';
import { LANGS } from "../../../common/languages.js";
import { getRequiredHostPermissions, hasProviderHostPermissions } from '../../../common/provider-permissions.js';
import { getChunkSizeOptions } from '../../../content/prompts/index.js';
import { resolveChunkSizePreset, DEFAULT_TARGET_SIZE } from '../../../content/prompts/utils.js';

// Map of pair keys to their settings modules
const PAIR_SETTINGS_MAP = {
  'ja_en': ja_en_settings,
  // 'en_es': en_es_settings,
  // 'zh-Hans_en': zh_Hans_en_settings,
};

// Stage metadata
const STAGES = {
  glossaryGenerate: { index: 1, providerSelectId: 'provider-glossary-generate', modelSelectId: 'model-glossary-generate' },
  glossaryUpdate: { index: 2, providerSelectId: 'provider-glossary-update', modelSelectId: 'model-glossary-update' },
  textChunking: { index: 3, providerSelectId: 'provider-text-chunking', modelSelectId: 'model-text-chunking' },
  translation: { index: 4, providerSelectId: 'provider-translation', modelSelectId: 'model-translation' },
  postEdit: { index: 5, providerSelectId: 'provider-postedit', modelSelectId: 'model-postedit' },
  fallback: { index: 6, providerSelectId: 'provider-fallback', modelSelectId: 'model-fallback' },
};

const SUPPORTED_LANGS = Object.entries(LANGS).map(([code, label]) => ({
  code,
  label,
}));

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Default config if nothing is stored yet
function getDefaultConfig() {
  return {
    llm: {
      glossaryGenerate: null,
      glossaryUpdate: null,
      textChunking: null,
      translation: null,
      postEdit: null,
      fallback: null,
    },

    updateGlossary: true,
    glossaryChunkSize: 3000,

    textSegmentation: {
      method: 'chunk',
      chunkSize: 2000,
      overlapCount: 10,
      targetSize: DEFAULT_TARGET_SIZE,
    },

    translation: {
      // Pair-specific options will go here
      contextLines: 5,
    },

    postEdit: false,

    sourceLang: 'ja',
    targetLang: 'en',

    mode: 'simple',          // 'simple' | 'advanced'
    showAllModels: false,     // advanced-only
  };
}

export class ModelsTabController {
  constructor() {
    this.tabId = 'models';

    this.root = null;
    this.statusElement = null;
    this.saveButton = null;
    this.cancelButton = null;

    this.modeSimpleRadio = null;
    this.modeAdvancedRadio = null;
    this.advancedSettingsContainer = null;

    this.showAllModelsCheckbox = null;
    this.refreshModelsButton = null;
    this.glossaryChunkSizeSelect = null;

    this.glossaryEnabledCheckbox = null;
    this.glossaryModelsContainer = null;

    this.segmentationMethodSelect = null;
    this.segmentationModelContainer = null;
    this.segmentationAdvancedContainer = null;
    this.chunkSizeSelect = null;
    this.overlapCountSelect = null;
    this.chunkTargetSizeSelect = null;
    this.chunkTargetSizeDesc = null;
    this.currentChunkSizeOptions = null;

    this.postEditEnabledCheckbox = null;
    this.postEditModelsContainer = null;

    this.sourceLangSelect = null;
    this.targetLangSelect = null;
    this.contextLinesSelect = null;
    this.translationPairSettingsContainer = null;
    this.currentPairModule = null;

    this.stageProviderSelects = {};
    this.stageModelSelects = {};

    this.models = [];          // full model list from backend
    this.config = getDefaultConfig();
    this.originalConfig = deepClone(this.config);

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

    await this.loadConfig();
    await this.loadModels();
  }

  initDom() {
    this.root = document.getElementById('tab-models');
    this.statusElement = document.getElementById('models-status');
    this.saveButton = document.getElementById('models-save');
    this.cancelButton = document.getElementById('models-cancel');
    this.phaseOutBanner = document.getElementById('models-update-banner');

    this.modeSimpleRadio = document.getElementById('mode-simple');
    this.modeAdvancedRadio = document.getElementById('mode-advanced');
    this.advancedSettingsContainer = document.getElementById('advanced-settings');

    this.showAllModelsCheckbox = document.getElementById('show-all-models');
    this.refreshModelsButton = document.getElementById('refresh-models');
    this.glossaryChunkSizeSelect = document.getElementById('glossary-chunk-size');

    this.glossaryEnabledCheckbox = document.getElementById('glossary-enabled');
    this.glossaryModelsContainer = document.getElementById('glossary-models');

    this.segmentationMethodSelect = document.getElementById('segmentation-method');
    this.segmentationModelContainer = document.getElementById('segmentation-model-container');
    this.segmentationAdvancedContainer = document.getElementById('segmentation-advanced-settings');
    this.chunkSizeSelect = document.getElementById('chunk-size');
    this.overlapCountSelect = document.getElementById('overlap-count');
    this.chunkTargetSizeSelect = document.getElementById('chunk-target-size');
    this.chunkTargetSizeDesc = document.getElementById('chunk-target-size-desc');

    this.postEditEnabledCheckbox = document.getElementById('postedit-enabled');
    this.postEditModelsContainer = document.getElementById('postedit-models');

    this.sourceLangSelect = document.getElementById('source-lang');
    this.targetLangSelect = document.getElementById('target-lang');
    this.contextLinesSelect = document.getElementById('context-lines');
    this.translationPairSettingsContainer = document.getElementById('translation-pair-settings');

    // Map stage -> selects
    for (const [stageKey, meta] of Object.entries(STAGES)) {
      const providerSelect = document.getElementById(meta.providerSelectId);
      const modelSelect = document.getElementById(meta.modelSelectId);
      this.stageProviderSelects[stageKey] = providerSelect;
      this.stageModelSelects[stageKey] = modelSelect;
    }
  }

  attachListeners() {
    // Mode toggles
    this.modeSimpleRadio.addEventListener('change', () => {
      if (this.modeSimpleRadio.checked) {
        this.config.mode = 'simple';
        this.updateModeUI();
        this.markDirty();
        // In simple mode, showAllModels is always false
        this.showAllModelsCheckbox.checked = false;
        this.config.showAllModels = false;
        void this.loadModels();
      }
    });

    this.modeAdvancedRadio.addEventListener('change', () => {
      if (this.modeAdvancedRadio.checked) {
        this.config.mode = 'advanced';
        this.updateModeUI();
        this.markDirty();
        void this.loadModels();
      }
    });

    // Show all models (advanced only)
    this.showAllModelsCheckbox.addEventListener('change', async () => {
      const showAll = this.showAllModelsCheckbox.checked;
      this.config.showAllModels = showAll;
      this.markDirty();

      if (showAll) {
        // When toggled ON, refresh models from providers first
        await this.refreshModels();
      } else {
        await this.loadModels();
      }
    });

    this.refreshModelsButton.addEventListener('click', async () => {
      await this.refreshModels();
    });

    // Glossary on/off
    this.glossaryEnabledCheckbox.addEventListener('change', () => {
      const enabled = this.glossaryEnabledCheckbox.checked;
      this.config.updateGlossary = enabled;
      this.glossaryModelsContainer.style.display = enabled ? '' : 'none';
      this.markDirty();
    });

    // Segmentation method
    this.segmentationMethodSelect.addEventListener('change', () => {
      const method = this.segmentationMethodSelect.value;
      this.config.textSegmentation.method = method;
      this.updateSegmentationUI();
      this.markDirty();
    });

    // Segmentation advanced values
    this.chunkSizeSelect.addEventListener('change', () => {
      this.config.textSegmentation.chunkSize = parseInt(this.chunkSizeSelect.value, 10);
      this.markDirty();
    });

    this.overlapCountSelect.addEventListener('change', () => {
      this.config.textSegmentation.overlapCount = parseInt(this.overlapCountSelect.value, 10);
      this.markDirty();
    });

    // Segment chunk target size
    this.chunkTargetSizeSelect.addEventListener('change', () => {
      this.config.textSegmentation.targetSize = this.chunkTargetSizeSelect.value;
      this.updateChunkTargetSizeDescription();
      this.markDirty();
    });

    // Post-edit on/off
    this.postEditEnabledCheckbox.addEventListener('change', () => {
      const enabled = this.postEditEnabledCheckbox.checked;
      this.config.postEdit = enabled;
      this.postEditModelsContainer.style.display = enabled ? '' : 'none';
      this.markDirty();
    });

    // Stage provider/model selectors
    for (const [stageKey, providerSelect] of Object.entries(this.stageProviderSelects)) {
      providerSelect.addEventListener('change', () => {
        this.handleProviderChange(stageKey);
      });
    }

    for (const [stageKey, modelSelect] of Object.entries(this.stageModelSelects)) {
      modelSelect.addEventListener('change', () => {
        this.handleModelChange(stageKey);
      });
    }

    // Language selectors
    this.sourceLangSelect.addEventListener('change', () => {
      this.config.sourceLang = this.sourceLangSelect.value;
      this.markDirty();
      this.onLanguagePairChanged();
    });

    this.targetLangSelect.addEventListener('change', () => {
      this.config.targetLang = this.targetLangSelect.value;
      this.markDirty();
      this.onLanguagePairChanged();
    });

    // Translation common settings
    this.contextLinesSelect.addEventListener('change', () => {
      const value = parseInt(this.contextLinesSelect.value, 10);
      this.config.translation.contextLines = value;
      this.markDirty();
    });

    // Save / Cancel
    this.saveButton.addEventListener('click', async () => {
      await this.save();
    });

    this.cancelButton.addEventListener('click', async () => {
      await this.reset();
    });
  }

  populateLanguageDropdowns() {
    const addOptions = (select) => {
      select.innerHTML = '';
      SUPPORTED_LANGS.forEach(({ code, label }) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${label} (${code})`;
        select.appendChild(option);
      });
    };

    addOptions(this.sourceLangSelect);
    addOptions(this.targetLangSelect);
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get('translation_config');
      const stored = result['translation_config'];

      if (stored && typeof stored === 'object') {
        // Merge into defaults to ensure all keys exist
        const merged = { ...getDefaultConfig(), ...stored };

        // Deep merge nested objects we care about
        merged.llm = { ...getDefaultConfig().llm, ...(stored.llm || {}) };
        merged.textSegmentation = {
          ...getDefaultConfig().textSegmentation,
          ...(stored.textSegmentation || {}),
        };
        merged.translation = {
          ...getDefaultConfig().translation,
          ...(stored.translation || {}),
        };

        this.config = merged;
      } else {
        this.config = getDefaultConfig();
      }

      this.originalConfig = deepClone(this.config);
      this.isDirty = false;
      this.applyConfigToUI();
      this.setStatus('', '');
    } catch (error) {
      console.error('[Options] Failed to load translation config:', error);
      this.setStatus('Failed to load translation settings.', 'error');
    }
  }

  applyConfigToUI() {
    // Mode
    const isAdvanced = this.config.mode === 'advanced';
    this.modeSimpleRadio.checked = !isAdvanced;
    this.modeAdvancedRadio.checked = isAdvanced;
    this.updateModeUI();

    // Advanced fields
    this.showAllModelsCheckbox.checked = !!this.config.showAllModels;
    this.glossaryChunkSizeSelect.value = String(this.config.glossaryChunkSize || 2000);

    // Glossary
    this.glossaryEnabledCheckbox.checked = !!this.config.updateGlossary;
    this.glossaryModelsContainer.style.display = this.config.updateGlossary ? '' : 'none';

    // Segmentation
    this.segmentationMethodSelect.value = this.config.textSegmentation.method || 'chunk';
    this.chunkSizeSelect.value = String(this.config.textSegmentation.chunkSize || 1500);
    this.overlapCountSelect.value = String(this.config.textSegmentation.overlapCount || 10);
    this.updateSegmentationUI();
    void this.renderChunkTargetSizeSelect();

    // Post-edit
    this.postEditEnabledCheckbox.checked = !!this.config.postEdit;
    this.postEditModelsContainer.style.display = this.config.postEdit ? '' : 'none';

    // Languages
    this.sourceLangSelect.value = this.config.sourceLang || 'ja';
    this.targetLangSelect.value = this.config.targetLang || 'en';

    // Translation common
    this.contextLinesSelect.value = String(this.config.translation.contextLines || 5);

    // Pair-specific UI (stub)
    this.renderPairSpecificSettings();
  }

  updateModeUI() {
    const isAdvanced = this.config.mode === 'advanced';
    this.advancedSettingsContainer.hidden = !isAdvanced;

    // Only show segmentation advanced if both advanced mode and 'chunk'
    const segIsChunk = this.segmentationMethodSelect.value === 'chunk';
    this.segmentationAdvancedContainer.hidden = !(isAdvanced && segIsChunk);
  }

  updateSegmentationUI() {
    const method = this.segmentationMethodSelect.value;
    const usesModel = method === 'chunk';
    this.segmentationModelContainer.style.display = usesModel ? '' : 'none';

    const isAdvanced = this.config.mode === 'advanced';
    this.segmentationAdvancedContainer.hidden = !(isAdvanced && usesModel);
  }

  /**
   * Populate the target chunk size select from the current language pair's presets.
   * Unknown or missing stored keys fall back to the default ('medium' or first key).
   */
  async renderChunkTargetSizeSelect() {
    if (!this.chunkTargetSizeSelect) return;

    const pairKey = `${this.config.sourceLang}_${this.config.targetLang}`;

    let options;
    try {
      options = await getChunkSizeOptions(pairKey);
    } catch (error) {
      console.error('[Options] Failed to load chunk size options:', error);
      options = null;
    }

    this.currentChunkSizeOptions = options || {};
    const keys = Object.keys(this.currentChunkSizeOptions);

    this.chunkTargetSizeSelect.innerHTML = '';
    if (keys.length === 0) {
      this.chunkTargetSizeDesc.textContent = '';
      return;
    }

    keys.forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      this.chunkTargetSizeSelect.appendChild(opt);
    });

    const { key } = this.resolveChunkTargetSize(this.config.textSegmentation.targetSize);
    this.chunkTargetSizeSelect.value = key;
    this.updateChunkTargetSizeDescription();
  }

  updateChunkTargetSizeDescription() {
    if (!this.chunkTargetSizeDesc) return;
    const preset = this.currentChunkSizeOptions?.[this.chunkTargetSizeSelect.value];
    this.chunkTargetSizeDesc.textContent = preset?.description || '';
  }

  resolveChunkTargetSize(value) {
    const options = this.currentChunkSizeOptions;
    if (options && Object.keys(options).length > 0) {
      return resolveChunkSizePreset(options, value);
    }
    return { key: value || DEFAULT_TARGET_SIZE };
  }

  async loadModels() {
    const showAll = this.config.mode === 'advanced' && this.config.showAllModels;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'get_models',
        payload: { showAll },
      });

      if (!response || !response.ok) {
        console.error('Failed to load models:', response?.error);
        this.setStatus('Failed to load models.', 'error');
        return;
      }

      this.models = Array.isArray(response.data) ? response.data : [];
      this.rebuildAllModelSelectors();
      this.updatePhaseOutUI();
    } catch (error) {
      console.error('Failed to load models:', error);
      this.setStatus('Failed to load models.', 'error');
    }
  }

  async refreshModels() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'refresh_models',
      });

      if (!response || !response.ok) {
        console.error('Failed to refresh models:', response?.error);
        this.setStatus('Failed to refresh models.', 'error');
        return;
      }

      await this.loadModels();
      this.setStatus('Model list refreshed.', 'success');
    } catch (error) {
      console.error('Failed to refresh models:', error);
      this.setStatus('Failed to refresh models.', 'error');
    }
  }

  getModelsForStage(stageKey) {
    const stageMeta = STAGES[stageKey];
    if (!stageMeta) return [];

    // Fallback model is generic; stage limits don't apply to it
    const isFallback = stageKey === 'fallback';
    const stageIndex = stageMeta.index;
    const isAdvanced = this.config.mode === 'advanced';
    const showAll = isAdvanced && this.config.showAllModels;

    let models = this.models.slice();

    if (!isAdvanced) {
      // Simple mode:
      // Only recommended models and respect limits (stages where they are suggested)
      models = models.filter((m) => {
        if (m.source !== 'recommended') return false;
        if (isFallback) return true;
        if (!Array.isArray(m.limits)) return true;
        return m.limits.includes(stageIndex);
      });
    } else {
      // Advanced mode:
      if (!showAll) {
        // Recommended only, ignore limits
        models = models.filter((m) => m.source === 'recommended');
      } else {
        // All models; ignore limits
        // no additional filtering
      }
    }

    // Phased-out models are never offered as selectable options
    return models.filter((m) => !m.deprecated);
  }

  /**
   * Finds a model in the full (unfiltered) model list, including deprecated ones.
   *
   * @param {string|null} id - Model identifier
   * @returns {Object|undefined} Model info or undefined
   */
  findModelById(id) {
    if (!id) return undefined;
    return this.models.find((m) => m.id === id);
  }

  /**
   * Whether the stored selection for a stage points to a phased-out model.
   *
   * @param {string} stageKey
   * @returns {boolean}
   */
  isDeprecatedSelected(stageKey) {
    const model = this.findModelById(this.config.llm[stageKey]);
    return !!model && model.deprecated === true;
  }

  /**
   * Shows/hides the global update banner and the per-stage inline warnings
   * based on which stored selections reference phased-out models.
   */
  updatePhaseOutUI() {
    let deprecatedCount = 0;

    for (const stageKey of Object.keys(STAGES)) {
      if (this.isDeprecatedSelected(stageKey)) deprecatedCount++;
      this.updateStagePhaseOutWarning(stageKey);
    }

    if (!this.phaseOutBanner) return;

    if (deprecatedCount > 0) {
      this.phaseOutBanner.textContent =
        `The recommended model list has been updated. ${deprecatedCount} of your model ` +
        `selection(s) refer to phased-out models. They will keep working until you change them, ` +
        `but updating is recommended.`;
      this.phaseOutBanner.hidden = false;
    } else {
      this.phaseOutBanner.textContent = '';
      this.phaseOutBanner.hidden = true;
    }
  }

  /**
   * Adds or removes the inline "phased out" warning under a stage's model selector.
   *
   * @param {string} stageKey
   */
  updateStagePhaseOutWarning(stageKey) {
    const modelSelect = this.stageModelSelects[stageKey];
    const block = modelSelect?.closest('.stage-block');
    if (!block) return;

    const existing = block.querySelector('.phaseout-warning');
    const affected = this.isDeprecatedSelected(stageKey);

    if (affected && !existing) {
      const warning = document.createElement('p');
      warning.className = 'phaseout-warning';
      warning.textContent =
        'This model has been phased out. It keeps working until you choose a replacement.';
      modelSelect.closest('label').after(warning);
    } else if (!affected && existing) {
      existing.remove();
    }
  }

  rebuildAllModelSelectors() {
    for (const stageKey of Object.keys(STAGES)) {
      this.populateStageSelectors(stageKey);
    }
  }

  populateStageSelectors(stageKey) {
    const modelsForStage = this.getModelsForStage(stageKey);
    const providerSelect = this.stageProviderSelects[stageKey];
    const modelSelect = this.stageModelSelects[stageKey];

    if (!providerSelect || !modelSelect) return;

    // Build provider list
    const providers = Array.from(
      new Set(modelsForStage.map((m) => m.provider)),
    );

    const allowNone = stageKey === 'fallback';

    providerSelect.innerHTML = '';
    modelSelect.innerHTML = '';

    if (allowNone) {
      const noneOpt = document.createElement('option');
      noneOpt.value = '';
      noneOpt.textContent = 'None';
      providerSelect.appendChild(noneOpt);
    }

    if (providers.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No models available';
      providerSelect.appendChild(opt);

      const opt2 = document.createElement('option');
      opt2.value = '';
      opt2.textContent = 'No models';
      modelSelect.appendChild(opt2);

      return;
    }

    // Determine currently selected model id
    const currentModelId = this.config.llm[stageKey] || null;
    const currentModel = modelsForStage.find((m) => m.id === currentModelId);
    let selectedProvider = currentModel ? currentModel.provider : providers[0];

    // Stored selection is a phased-out model: keep it selected (with a warning)
    // until the user actively picks a replacement.
    if (!currentModel && this.isDeprecatedSelected(stageKey)) {
      const deprecatedModel = this.findModelById(currentModelId);
      if (deprecatedModel && !providers.includes(deprecatedModel.provider)) {
        providers.push(deprecatedModel.provider);
      }
      selectedProvider = deprecatedModel ? deprecatedModel.provider : selectedProvider;
    }

    // Populate provider select (after the "None" option, if present)
    providers.forEach((provider) => {
      const opt = document.createElement('option');
      opt.value = provider;
      opt.textContent = provider === 'local' ? 'Local' : provider === 'nanogpt' ? 'NanoGPT' : provider;
      if (provider === selectedProvider) {
        opt.selected = true;
      }
      providerSelect.appendChild(opt);
    });

    // No fallback model configured: select "None" and show disabled model select
    if (allowNone && !currentModelId) {
      providerSelect.value = '';
      this.populateModelOptions(stageKey, '', null);
      return;
    }

    this.populateModelOptions(stageKey, selectedProvider, currentModelId);
  }

  populateModelOptions(stageKey, provider, selectedModelId) {
    const modelsForStage = this.getModelsForStage(stageKey);
    const providerModels = modelsForStage.filter((m) => m.provider === provider);
    const modelSelect = this.stageModelSelects[stageKey];
    if (!modelSelect) return;

    modelSelect.innerHTML = '';

    if (stageKey === 'fallback' && !provider) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'None (retries use the same model)';
      modelSelect.appendChild(opt);
      modelSelect.disabled = true;
      this.config.llm[stageKey] = null;
      return;
    }

    // Local LLM: no model choice — endpoint and params are set in the API Keys tab
    if (provider === 'local') {
      const opt = document.createElement('option');
      opt.value = 'local-1';
      opt.textContent = 'Local (port configured in API Keys tab)';
      opt.selected = true;
      modelSelect.appendChild(opt);
      modelSelect.disabled = true;
      this.config.llm[stageKey] = 'local-1';
      return;
    }

    modelSelect.disabled = false;

    // A phased-out stored selection is still offered (marked) so the selector
    // retains the old id until the user chooses a replacement.
    const deprecatedSelected = selectedModelId ? this.findModelById(selectedModelId) : null;
    const showDeprecatedSelected =
      !!deprecatedSelected && deprecatedSelected.deprecated && deprecatedSelected.provider === provider;

    if (providerModels.length === 0 && !showDeprecatedSelected) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No models';
      modelSelect.appendChild(opt);
      this.config.llm[stageKey] = null;
      return;
    }

    // Recommended first, then provider ones
    const recommended = providerModels.filter((m) => m.source === 'recommended');
    const others = providerModels.filter((m) => m.source !== 'recommended');
    const ordered = [...recommended, ...others];

    let deprecatedOptionAdded = false;
    if (showDeprecatedSelected) {
      const opt = document.createElement('option');
      opt.value = deprecatedSelected.id;
      opt.textContent = `${deprecatedSelected.label} (phased out)`;
      opt.selected = true;
      modelSelect.appendChild(opt);
      deprecatedOptionAdded = true;
    }

    ordered.forEach((model) => {
      const opt = document.createElement('option');
      opt.value = model.id;
      const prefix = model.source === 'recommended' ? '★ ' : '';
      opt.textContent = `${prefix}${model.label}`;
      if (model.id === selectedModelId) {
        opt.selected = true;
      }
      modelSelect.appendChild(opt);
    });

    // If selected id is not in the list, default to the first
    const foundSelected = deprecatedOptionAdded || ordered.some((m) => m.id === selectedModelId);
    if (!foundSelected) {
      modelSelect.selectedIndex = 0;
      this.config.llm[stageKey] = ordered[0].id;
    } else {
      this.config.llm[stageKey] = selectedModelId;
    }
  }

  handleProviderChange(stageKey) {
    const providerSelect = this.stageProviderSelects[stageKey];
    if (!providerSelect) return;

    const provider = providerSelect.value;
    const currentModelId = this.config.llm[stageKey] || null;
    this.populateModelOptions(stageKey, provider, currentModelId);
    this.markDirty();
    this.updatePhaseOutUI();
  }

  handleModelChange(stageKey) {
    const modelSelect = this.stageModelSelects[stageKey];
    if (!modelSelect) return;

    const modelId = modelSelect.value || null;
    this.config.llm[stageKey] = modelId;
    this.markDirty();
    this.updatePhaseOutUI();
  }

  onLanguagePairChanged() {
    // In the future, this might request pair-specific defaults from the background worker.
    this.renderPairSpecificSettings();
    void this.renderChunkTargetSizeSelect();
  }

  renderPairSpecificSettings() {
    const source = this.config.sourceLang;
    const target = this.config.targetLang;
    const pairKey = `${source}_${target}`;

    // Cleanup previous pair module
    if (this.currentPairModule && typeof this.currentPairModule.cleanup === 'function') {
      this.currentPairModule.cleanup();
    }
    this.currentPairModule = null;

    this.translationPairSettingsContainer.innerHTML = '';

    // Look up pair module from static map
    const pairSettings = PAIR_SETTINGS_MAP[pairKey];

    if (pairSettings && typeof pairSettings.render === 'function') {
      this.currentPairModule = pairSettings;

      pairSettings.render(this.translationPairSettingsContainer, () => {
        this.markDirty();
      });

      pairSettings.applyConfig(this.config.translation);
    } else {
      // No specific settings for this pair
      const p = document.createElement('p');
      p.textContent = `No additional settings for ${pairKey}.`;
      p.style.fontStyle = 'italic';
      p.style.color = '#666';
      this.translationPairSettingsContainer.appendChild(p);
    }
  }

  buildConfigFromUI() {
    const config = getDefaultConfig();

    // Mode
    config.mode = this.modeAdvancedRadio.checked ? 'advanced' : 'simple';
    config.showAllModels = config.mode === 'advanced' && this.showAllModelsCheckbox.checked;

    // Glossary
    const glossaryEnabled = this.glossaryEnabledCheckbox.checked;
    config.updateGlossary = glossaryEnabled;
    if (glossaryEnabled) {
      config.llm.glossaryGenerate = this.stageModelSelects.glossaryGenerate.value || null;
      config.llm.glossaryUpdate = this.stageModelSelects.glossaryUpdate.value || null;
    } else {
      config.llm.glossaryGenerate = null;
      config.llm.glossaryUpdate = null;
    }

    // Advanced: glossary chunk size
    if (config.mode === 'advanced') {
      config.glossaryChunkSize = parseInt(this.glossaryChunkSizeSelect.value, 10);
    } else {
      config.glossaryChunkSize = this.config.glossaryChunkSize || 2000;
    }

    // Segmentation
    const method = this.segmentationMethodSelect.value;
    config.textSegmentation.method = method;
    if (method === 'chunk') {
      config.llm.textChunking = this.stageModelSelects.textChunking.value || null;
      if (config.mode === 'advanced') {
        config.textSegmentation.chunkSize = parseInt(this.chunkSizeSelect.value, 10);
        config.textSegmentation.overlapCount = parseInt(this.overlapCountSelect.value, 10);
        config.textSegmentation.targetSize = this.resolveChunkTargetSize(this.chunkTargetSizeSelect.value).key;
      } else {
        config.textSegmentation.chunkSize = this.config.textSegmentation.chunkSize || 1500;
        config.textSegmentation.overlapCount = this.config.textSegmentation.overlapCount || 10;
        config.textSegmentation.targetSize = this.config.textSegmentation.targetSize || DEFAULT_TARGET_SIZE;
      }
    } else {
      config.llm.textChunking = null;
    }

    // Translation
    config.llm.translation = this.stageModelSelects.translation.value || null;

    config.sourceLang = this.sourceLangSelect.value;
    config.targetLang = this.targetLangSelect.value;
    config.translation.contextLines = parseInt(this.contextLinesSelect.value, 10);

    // Merge pair-specific settings if a module is loaded
    if (this.currentPairModule && typeof this.currentPairModule.getConfig === 'function') {
      const pairConfig = this.currentPairModule.getConfig();
      Object.assign(config.translation, pairConfig);
    }

    // Fallback model for malformed-output retries (generic across stages)
    config.llm.fallback = this.stageModelSelects.fallback.value || null;

    // Post-edit
    const postEditEnabled = this.postEditEnabledCheckbox.checked;
    config.postEdit = postEditEnabled;
    if (postEditEnabled) {
      config.llm.postEdit = this.stageModelSelects.postEdit.value || null;
    } else {
      config.llm.postEdit = null;
    }

    return config;
  }

  validateConfig(config) {
    // Very basic validation; extend as needed.
    if (!config.sourceLang || !config.targetLang) {
      this.setStatus('Source and target language must be selected.', 'error');
      return false;
    }

    if (config.updateGlossary) {
      if (!config.llm.glossaryGenerate || !config.llm.glossaryUpdate) {
        this.setStatus('Glossary generation and update models must be selected when glossary is enabled.', 'error');
        return false;
      }
    }

    if (config.textSegmentation.method === 'chunk') {
      if (!config.llm.textChunking) {
        this.setStatus('Text segmentation model must be selected when using chunked method.', 'error');
        return false;
      }
    }

    if (!config.llm.translation) {
      this.setStatus('Translation model must be selected.', 'error');
      return false;
    }

    if (config.postEdit && !config.llm.postEdit) {
      this.setStatus('Post-edit model must be selected when post-edit is enabled.', 'error');
      return false;
    }

    // If everything looks okay
    return true;
  }

  /**
   * Checks that every provider selected for a stage has its required host
   * permissions granted (core host_permissions or granted optional ones).
   *
   * @param {Object} config - Config built from the UI
   * @returns {Promise<boolean>} True if all selected providers are permitted
   */
  async validateProviderPermissions(config) {
    const providers = new Set();

    for (const modelId of Object.values(config.llm)) {
      if (!modelId) continue;
      const model = this.findModelById(modelId);
      // The local pseudo-model is absent from the list when the feature is
      // disabled; map its id directly so stale selections are still checked.
      const provider = model?.provider || (modelId === 'local-1' ? 'local' : null);
      if (provider) providers.add(provider);
    }

    for (const provider of providers) {
      if (getRequiredHostPermissions(provider).length === 0) continue;

      if (!(await hasProviderHostPermissions(provider))) {
        const label = provider === 'local' ? 'Local' : provider === 'nanogpt' ? 'NanoGPT' : provider;
        this.setStatus(
          `Missing host permission for provider "${label}". Grant it in the API Keys tab before saving.`,
          'error'
        );
        return false;
      }
    }

    return true;
  }

  async save() {
    const newConfig = this.buildConfigFromUI();

    if (!this.validateConfig(newConfig)) {
      return;
    }

    if (!(await this.validateProviderPermissions(newConfig))) {
      return;
    }

    try {
      await chrome.storage.local.set({ 'translation_config': newConfig });
      this.config = newConfig;
      this.originalConfig = deepClone(newConfig);
      this.isDirty = false;
      this.setStatus('Translation settings saved.', 'success');
    } catch (error) {
      console.error('[Options] Failed to save translation config:', error);
      this.setStatus('Failed to save translation settings.', 'error');
      throw error;
    }
  }

  async reset() {
    this.config = deepClone(this.originalConfig);
    this.isDirty = false;
    await this.applyConfigToUI();
    this.rebuildAllModelSelectors();
    this.updatePhaseOutUI();
    this.setStatus('Changes discarded.', 'info');
  }

  canNavigateAway() {
    return !this.isDirty;
  }

  markDirty() {
    this.isDirty = true;
    // Optionally clear status on change
    // this.setStatus('', '');
  }

  setStatus(message, type) {
    if (!this.statusElement) return;
    this.statusElement.textContent = message || '';
    this.statusElement.dataset.statusType = type || '';
  }
}

export const modelsTabController = new ModelsTabController();
