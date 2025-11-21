import { buildGlossaryKeys } from './dom-adapter'; // Existing adapter
import { GlossaryRepository } from '../common/glossary-store';
import { GlossaryEditor } from '../common/glossary-ui';
import { POPUP_MSG_TYPE } from "../common/messaging.js";
import { LANGS } from "../common/languages.js";

let activeOverlay = null;

export async function openGlossaryEditor(sourceLang, targetLang) {
  if (activeOverlay) return; // Already open

  // 1. Resolve Keys
  const { seriesKey, globalKey } = buildGlossaryKeys(sourceLang, targetLang);

  // 2. Load Data
  const [seriesData, globalData] = await Promise.all([
    GlossaryRepository.load(seriesKey),
    GlossaryRepository.load(globalKey),
  ]);

  // 3. Create Host & Shadow
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5); z-index: 2147000000; display: flex;
    justify-content: center; align-items: center;
  `;

  const host = document.createElement('div');
  host.style.cssText = `width: 90%; height: 85vh; border-radius: 8px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.3);`;

  const shadow = host.attachShadow({ mode: 'open' });
  overlay.appendChild(host);
  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // 4. Initialize Editor
  const editor = new GlossaryEditor(shadow, {
    onSave: async (newSeriesData, newGlobalData) => {
      await Promise.all([
        GlossaryRepository.save(seriesKey, newSeriesData),
        GlossaryRepository.save(globalKey, newGlobalData),
      ]);
    },
    onClose: () => {
      document.body.removeChild(overlay);
      activeOverlay = null;
    },
  });

  // 5. Render
  editor.render(seriesData, globalData, {
    title: 'Glossary Editor',
    subtitle: `${LANGS[sourceLang]} -> ${LANGS[targetLang]}`,
  });

  // Close on click outside
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      activeOverlay = null;
    }
  });
}
