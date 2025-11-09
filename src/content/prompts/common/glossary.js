export const supportedLanguages = ['en', 'es', 'fr', 'ja'];

// Multi-language example data
const examples = {
  characterName: {
    ja: '天照',
    en: 'Amaterasu',
    es: 'Amaterasu',
    fr: 'Amaterasu'
  },
  locationName: {
    ja: '東京',
    en: 'Tokyo',
    es: 'Tokio',
    fr: 'Tokyo'
  },
  magicTerm: {
    ja: '魔法',
    en: 'magic',
    es: 'magia',
    fr: 'magie'
  }
};

export default {
  build(text, config) {
    const { sourceLang, targetLang, priorGlossary } = config;

    // Validate languages are supported (defensive check)
    if (!supportedLanguages.includes(sourceLang) || !supportedLanguages.includes(targetLang)) {
      throw new Error(`[common/glossary] Unsupported language pair: ${sourceLang}-${targetLang}`);
    }

    const system = `You are a linguistic analyst. Your task is to identify proper nouns, character names, locations, and specialized terms that require consistent translation.`;

    // Build examples using the specific language pair
    const exampleLines = [
      `[character] Name: ${examples.characterName[targetLang]} (${examples.characterName[sourceLang]})`,
      `[location] Name: ${examples.locationName[targetLang]} (${examples.locationName[sourceLang]})`,
      `[term] Name: ${examples.magicTerm[targetLang]} (${examples.magicTerm[sourceLang]})`
    ].join('\n');

    const instructions = `
### Task
Analyze the provided ${sourceLang} text and extract:
- Character names
- Location names
- Specialized terms (magic, skills, titles, etc.)

### Output Format
Return a JSON object where each key is the source term and the value is an object with:
- \`translation\`: the ${targetLang} translation
- \`notes\`: (optional) context or disambiguation
- \`variants\`: (optional) array of alternative forms

### Examples:
${exampleLines}
`.trim();

    const mergeInstruction = priorGlossary && Object.keys(priorGlossary).length > 0
                             ? `\n### Prior Glossary\nMerge with the following existing entries. Do not overwrite unless the prior entry is clearly incorrect:\n${JSON.stringify(priorGlossary, null, 2)}`
                             : '';

    const user = `
${instructions}
${mergeInstruction}

Analyze the following text:
<raw-text>
${text}
</raw-text>
`.trim();

    return { system, user };
  }
};