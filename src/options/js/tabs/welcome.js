import docsHtml from '../../docs.md';

export class WelcomeTabController {
  constructor() {
    this.tabId = 'welcome';
    this.root = null;
    this.contentContainer = null;
    this.isInitialized = false;
  }

  onShow() {
    if (!this.isInitialized) {
      this.initDom();
      this.renderDocs();
      this.isInitialized = true;
    }
  }

  initDom() {
    this.root = document.getElementById('tab-welcome');
    this.contentContainer = document.getElementById('welcome-docs');
  }

  renderDocs() {
    if (!this.contentContainer) return;

    // Inject the pre-baked HTML
    this.contentContainer.innerHTML = docsHtml;
  }

  canNavigateAway() {
    // Read-only tab, always safe to leave
    return true;
  }
}

export const welcomeTabController = new WelcomeTabController();
