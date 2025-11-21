import { apiKeysTabController } from './tabs/api-keys.js';
import { modelsTabController } from './tabs/models.js';
import { glossaryTabController } from "./tabs/glossary-tab.js";

document.addEventListener('DOMContentLoaded', () => {
  const sidebarButtons = Array.from(
    document.querySelectorAll('.sidebar-item')
  );
  const tabs = Array.from(
    document.querySelectorAll('.tab')
  );

  const unsavedDialog = document.getElementById('unsaved-dialog');

  const tabControllers = {
    'api-keys': apiKeysTabController,
    'models': modelsTabController,
    'glossary': glossaryTabController,
    // 'custom-instructions': customInstructionsTabController,
  };

  let currentTabId = 'welcome';
  let pendingTabId = null;

  function setActiveSidebarItem(tabId) {
    sidebarButtons.forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function setActiveTabContent(tabId) {
    tabs.forEach((tab) => {
      if (tab.id === `tab-${tabId}`) {
        tab.classList.add('active');
        tab.removeAttribute('hidden');
      } else {
        tab.classList.remove('active');
        tab.setAttribute('hidden', 'hidden');
      }
    });
  }

  async function onTabShown(tabId) {
    const controller = tabControllers[tabId];
    if (controller && typeof controller.onShow === 'function') {
      await controller.onShow();
    }
  }

  function showTab(tabId) {
    if (!tabId || tabId === currentTabId) return;

    setActiveSidebarItem(tabId);
    setActiveTabContent(tabId);
    currentTabId = tabId;

    void onTabShown(tabId);
  }

  function canNavigateAway(fromTabId) {
    const controller = tabControllers[fromTabId];
    if (controller && typeof controller.canNavigateAway === 'function') {
      return controller.canNavigateAway();
    }
    return true;
  }

  function openUnsavedDialog(targetTabId) {
    pendingTabId = targetTabId;
    unsavedDialog.hidden = false;
  }

  function closeUnsavedDialog() {
    unsavedDialog.hidden = true;
    pendingTabId = null;
  }

  function setupUnsavedDialogHandlers() {
    unsavedDialog.addEventListener('click', async (event) => {
      const btn = event.target;
      if (!(btn instanceof HTMLButtonElement)) return;

      const action = btn.dataset.unsavedAction;
      if (!action) return;

      const currentController = tabControllers[currentTabId];

      if (action === 'save') {
        if (currentController && typeof currentController.save === 'function') {
          try {
            await currentController.save();
          } catch {
            // Save failed; stay on current tab
          }
        }
        closeUnsavedDialog();
        if (pendingTabId) {
          showTab(pendingTabId);
        }

      } else if (action === 'discard') {
        if (currentController && typeof currentController.reset === 'function') {
          currentController.reset();
        }
        closeUnsavedDialog();
        if (pendingTabId) {
          showTab(pendingTabId);
        }

      } else if (action === 'cancel') {
        closeUnsavedDialog();
      }
    });
  }

  function attemptTabSwitch(targetTabId) {
    if (targetTabId === currentTabId) return;

    const allowed = canNavigateAway(currentTabId);

    if (allowed) {
      showTab(targetTabId);
    } else {
      openUnsavedDialog(targetTabId);
    }
  }

  sidebarButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const targetTabId = btn.dataset.tab;
      attemptTabSwitch(targetTabId);
    });
  });

  showTab('welcome');
  setupUnsavedDialogHandlers();

  window.addEventListener('beforeunload', (event) => {
    const allowed = canNavigateAway(currentTabId);
    if (!allowed) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
});
