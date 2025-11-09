/**
 *
 * Replace text on webpage with translations
 */

export function replaceText(translatedData) {
  console.log(`[Replacer] Replacing ${translatedData.length} text segments`);

  for (const item of translatedData) {
    if (item.element && item.translation) {
      item.element.textContent = item.translation;
    }
  }

  console.log('[Replacer] Text replacement complete');
}