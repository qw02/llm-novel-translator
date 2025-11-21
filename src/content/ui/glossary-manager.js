import { buildGlossaryKeys } from '../dom-adapter.js'; // Existing adapter
import { GlossaryRepository } from '../../common/glossary-store.js';
import { GlossaryEditor } from '../../common/glossary-ui.js';
import { LANGS } from "../../common/languages.js";
import { createShadowOverlay } from './ui-overlay-helper.js';

let activeGlossaryClose = null;

export async function openGlossaryEditor(sourceLang, targetLang) {
  // Close existing if open
  if (activeGlossaryClose) {
    activeGlossaryClose();
    activeGlossaryClose = null;
  }

  // 1. Resolve Keys
  const { seriesKey, globalKey } = buildGlossaryKeys(sourceLang, targetLang);

  // 2. Load Data
  const [seriesData, globalData] = await Promise.all([
    GlossaryRepository.load(seriesKey),
    GlossaryRepository.load(globalKey),
  ]);

  const { shadow, close, bringToFront } = createShadowOverlay();
  activeGlossaryClose = close;

  // 3. Initialize Editor
  const editor = new GlossaryEditor(shadow, {
    onSave: async (newSeries, newGlobal) => {
      await Promise.all([
        GlossaryRepository.save(seriesKey, newSeries),
        GlossaryRepository.save(globalKey, newGlobal)
      ]);
    },
    onClose: () => {
      close();
      activeGlossaryClose = null;
    }
  });

  editor.render(seriesData, globalData, {
    title: 'Glossary Editor',
    subtitle: `${sourceLang.toUpperCase()} -> ${targetLang.toUpperCase()}`
  });
}
