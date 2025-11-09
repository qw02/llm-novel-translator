export default {
  build(text, config) {
    const { sourceLang = 'source language', targetLang = 'target language', priorGlossary } = config;

    const system = `You are a linguistic analyst. Identify proper nouns, names, locations, and specialized terms that require consistent translation.`;

    const instructions = `
### Task
Analyze the provided ${sourceLang} text and extract:
- Character names
- Location names
- Specialized terms

### Output Format
Return a JSON object where each key is the source term and the value is an object with:
- \`translation\`: the ${targetLang} translation
- \`notes\`: (optional) context or disambiguation

### Examples:
[character] Name: XXX (YYY)
[location] Name: XXX (YYY)
[term] Name: XXX (YYY)
`.trim();

    const mergeInstruction = priorGlossary && Object.keys(priorGlossary).length > 0
                             ? `\n### Prior Glossary\nMerge with existing entries:\n${JSON.stringify(priorGlossary, null, 2)}`
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