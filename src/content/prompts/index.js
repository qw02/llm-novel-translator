const promptCache = new Map();

// Eagerly load all prompt modules
const promptModules = import.meta.glob(
  ['./**/*.js', '!./**/__tests__/**', '!./**/*.test.js'],
  { eager: true },
);

/**
 * Load a prompt builder with 3-tier fallback:
 * 1. Specific pair (e.g., ja_en/glossary-generate.js)
 * 2. Common group (common/glossary-generate.js, if both langs supported)
 * 3. Generic (generic/glossary-generate.js, all other langs)
 */
export async function getPromptBuilder(langPair, stage) {
  const [sourceLang, targetLang] = langPair.split('_');
  const cacheKey = `${langPair}:${stage}`;

  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey);
  }

  let builderModule;
  let fallbackLevel;

  // Tier 1: Try specific pair
  const specificPath = `./${langPair}/${stage}.js`;
  if (promptModules[specificPath]) {
    builderModule = promptModules[specificPath];
    fallbackLevel = 'specific';
  }

  // Tier 2: Try common group if specific not found
  if (!builderModule) {
    const commonPath = `./common/${stage}.js`;
    const commonModule = promptModules[commonPath];
    if (commonModule && supportsLanguagePair(commonModule, sourceLang, targetLang)) {
      builderModule = commonModule;
      fallbackLevel = 'common';
    }
  }

  // Tier 3: Use generic fallback
  if (!builderModule) {
    const genericPath = `./generic/${stage}.js`;
    builderModule = promptModules[genericPath];
    if (builderModule) {
      fallbackLevel = 'generic';
    } else {
      throw new Error(`[Prompts] No prompt builder found for stage "${stage}"`);
    }
  }

  const builder = builderModule.default;
  if (!builder || typeof builder.build !== 'function') {
    throw new Error(`[Prompts] Invalid builder for ${langPair}/${stage}: must export default { build(...args) }`);
  }

  console.log(`[Prompts] Loaded ${stage} for ${langPair} (level: ${fallbackLevel})`);
  promptCache.set(cacheKey, builder);
  return builder;
}

export function clearPromptCache() {
  promptCache.clear();
}

function supportsLanguagePair(module, sourceLang, targetLang) {
  const supported = module?.supportedLanguages || [];
  return supported.includes(sourceLang) && supported.includes(targetLang);
}