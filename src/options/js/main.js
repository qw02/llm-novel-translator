document.addEventListener('DOMContentLoaded', () => {
  const sidebarButtons = Array.from(
    document.querySelectorAll('.sidebar-item')
  );
  const tabs = Array.from(
    document.querySelectorAll('.tab')
  );

  let currentTabId = 'welcome';

  /**
   * Central check that runs:
   *  - before switching tabs
   *  - before closing/reloading the options page
   *
   * For now it always returns true.
   * You can later replace this with per-tab checks like:
   *   return tabState[currentTabId]?.canNavigateAway() ?? true;
   */
  function canNavigateAway(fromTabId) {
    // Placeholder logic for now:
    // Always allow navigation / closing.
    return true;
  }

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

  function showTab(targetTabId) {
    if (!targetTabId || targetTabId === currentTabId) {
      return;
    }

    const allowed = canNavigateAway(currentTabId);
    if (!allowed) {
      // In the future, you might open a modal here:
      // "Discard changes?" with Save / Discard / Cancel.
      return;
    }

    // Switch active sidebar item
    setActiveSidebarItem(targetTabId);

    // Switch visible tab content
    setActiveTabContent(targetTabId);

    currentTabId = targetTabId;
  }

  // Sidebar click wiring
  sidebarButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const targetTabId = btn.dataset.tab;
      showTab(targetTabId);
    });
  });

  // Always land on the welcome tab on load/refresh
  showTab('welcome');

  // Run navigation check when the user tries to close or reload this page
  window.addEventListener('beforeunload', (event) => {
    const allowed = canNavigateAway(currentTabId);

    if (!allowed) {
      // Standard pattern to trigger the browser's "Leave site?" dialog.
      event.preventDefault();
      event.returnValue = '';
    }
  });
});