const promptCache = new Map();

const promptModules = import.meta.glob(
  ['./**/*.js', '!./**/__tests__/**', '!./**/*.test.js'],
  { eager: true },
);

/**
 * Resolve a prompt builder module with 3-tier fallback:
 * 1. Specific pair (e.g., ja_en/glossary-generate.js)
 * 2. Common group (common/glossary-generate.js, if both langs supported)
 * 3. Generic (generic/glossary-generate.js, all other langs)
 *
 * @returns {{module: Object, fallbackLevel: 'specific'|'common'|'generic'}}
 */
function resolvePromptModule(langPair, stage) {
  const [sourceLang, targetLang] = langPair.split('_');

  // Tier 1: Try specific pair
  const specificPath = `./${langPair}/${stage}.js`;
  if (promptModules[specificPath]) {
    return { module: promptModules[specificPath], fallbackLevel: 'specific' };
  }

  // Tier 2: Try common group if specific not found
  const commonPath = `./common/${stage}.js`;
  const commonModule = promptModules[commonPath];
  if (commonModule && supportsLanguagePair(commonModule, sourceLang, targetLang)) {
    return { module: commonModule, fallbackLevel: 'common' };
  }

  // Tier 3: Use generic fallback
  const genericModule = promptModules[`./generic/${stage}.js`];
  if (genericModule) {
    return { module: genericModule, fallbackLevel: 'generic' };
  }

  throw new Error(`[Prompts] No prompt builder found for stage "${stage}"`);
}

/**
 * Load a prompt builder with 3-tier fallback (see resolvePromptModule).
 */
export async function getPromptBuilder(langPair, stage) {
  const cacheKey = `${langPair}:${stage}`;

  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey);
  }

  const { module: builderModule } = resolvePromptModule(langPair, stage);

  const builder = builderModule.default;
  if (!builder || typeof builder.build !== 'function') {
    throw new Error(`[Prompts] Invalid builder for ${langPair}/${stage}: must export default { build(...args) }`);
  }

  promptCache.set(cacheKey, builder);
  return builder;
}

/**
 * Load the chunkSizeOptions object for the text-segmentation stage of a language pair.
 * Uses the same 3-tier fallback as getPromptBuilder; if the resolved module does not
 * export chunkSizeOptions, falls back to the generic module's (which must define it).
 *
 * @param {string} langPair - e.g. 'ja_en'
 * @returns {Object} Map of size key (e.g. 'small') → { description, ...params }
 */
export async function getChunkSizeOptions(langPair) {
  const stage = 'text-segmentation';
  const { module: builderModule } = resolvePromptModule(langPair, stage);

  if (builderModule.chunkSizeOptions) {
    return builderModule.chunkSizeOptions;
  }

  const genericModule = promptModules[`./generic/${stage}.js`];
  if (genericModule?.chunkSizeOptions) {
    return genericModule.chunkSizeOptions;
  }

  throw new Error(`[Prompts] No chunkSizeOptions found for stage "${stage}"`);
}

export function clearPromptCache() {
  promptCache.clear();
}

function supportsLanguagePair(module, sourceLang, targetLang) {
  const supported = module?.supportedLanguages || [];
  return supported.includes(sourceLang) && supported.includes(targetLang);
}
