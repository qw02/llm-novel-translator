/**
 *
 * Replace text on webpage with translations
 */

export function replaceText(translatedData) {
  console.log(`[Replacer] Replacing ${translatedData.length} text segments`);
  console.log(translatedData);

  for (const item of translatedData) {
    const element = document.getElementById(item.id);
    element.textContent = item.translatedText;
  }

  console.log('[Replacer] Text replacement complete');
}