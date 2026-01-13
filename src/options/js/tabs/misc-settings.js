
class MiscSettingsTabController {
  constructor() {
    this.tabId = 'misc-settings';
    this.root = null;
    this.inputLogging = null;
    this.statusElement = null;
    this.saveButton = null;
    this.cancelButton = null;

    this.isInitialized = false;
    this.isDirty = false;
    this.originalSettings = {};
  }

  async onShow() {
    if (!this.isInitialized) {
      this.initDom();
      this.attachListeners();
      this.isInitialized = true;
    }
    await this.loadSettings();
  }

  initDom() {
    this.root = document.getElementById('tab-misc-settings');
    this.inputLogging = document.getElementById('misc-logging-enabled');
    this.statusElement = document.getElementById('misc-settings-status');
    this.saveButton = document.getElementById('misc-settings-save');
    this.cancelButton = document.getElementById('misc-settings-cancel');
  }

  attachListeners() {
    if (this.inputLogging) {
      this.inputLogging.addEventListener('change', () => {
        this.markDirty();
      });
    }

    if (this.saveButton) {
      this.saveButton.addEventListener('click', async () => {
        await this.save();
      });
    }

    if (this.cancelButton) {
      this.cancelButton.addEventListener('click', () => {
        this.reset();
      });
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get('loggingEnabled');
      this.originalSettings = {
        loggingEnabled: result.loggingEnabled ?? false
      };

      if (this.inputLogging) {
        this.inputLogging.checked = this.originalSettings.loggingEnabled;
      }

      this.isDirty = false;
      this.setStatus('', '');
    } catch (error) {
      console.error('[Options] Failed to load misc settings:', error);
      this.setStatus('Failed to load settings.', 'error');
    }
  }

  markDirty() {
    this.isDirty = true;
  }

  async save() {
    const updated = {
      loggingEnabled: this.inputLogging ? this.inputLogging.checked : false
    };

    try {
      await chrome.storage.local.set(updated);
      this.originalSettings = { ...updated };
      this.isDirty = false;
      this.setStatus('Settings saved.', 'success');
    } catch (error) {
      console.error('[Options] Failed to save misc settings:', error);
      this.setStatus('Failed to save settings.', 'error');
      throw error;
    }
  }

  reset() {
    if (this.inputLogging) {
      this.inputLogging.checked = this.originalSettings.loggingEnabled;
    }

    this.isDirty = false;
    this.setStatus('Changes discarded.', 'info');
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

export const miscSettingsController = new MiscSettingsTabController();
