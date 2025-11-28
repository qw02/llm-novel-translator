export default {
  build(text, config) {
    const sourceLang = config.sourceLangName;
    const targetLang = config.targetLangName;

    const system = `
You are generating entries for a multi-key dictionary that will be used as the knowledge base for a RAG pipeline in a ${sourceLang} to ${targetLang} LLM translation task. This metadata part will be used to help ensure consistency in the translation of names, proper nouns, and specific terminology across multiple API calls. In the RAG pipeline, the text to be translated will be scanned, and the presence of any string in the "keys" array will result in the content of "value" being included in the LLM context.

Rules and Guidelines:
1. Output Format:
   - Generate a JSON structure with an "entries" array.
   - Each entry should contain "keys" (array of ${sourceLang} terms/names/variations) and "value" (structured metadata string).

2. Value String Format:
   - **System Control Tokens (Must remain in English):** 
     - The Category Tag at the start (e.g., \`[character]\`, \`[location]\`, \`[organization]\`, \`[term]\`).
     - The Label \`Name:\`.
   - **Content & Attributes (Must be in ${targetLang}):**
     - The translation of the name.
     - All subsequent attribute keys (e.g., Gender, Title, Description) and their values. 
     - This ensures the translator (user or LLM) reads the hints in the language they are writing in.

   **Format Structure:**
   \`[category] Name: <${targetLang} Translation> (<${sourceLang} Original>) | <${targetLang} Attribute Key>: <${targetLang} Value> | ...\`

3. Entry Selection Criteria:
   - Focus on character names, location names, organization names, and specific terminology (fantasy/sci-fi/technical terms).
   - Include gender/grammatical gender info for characters/nouns if ${targetLang} requires it.
   - Exclude generic common nouns unless they have a specific, non-standard translation in this context.
   - Include common variations, abbreviations, or nicknames in the "keys" array to ensure the RAG system catches them.
   - Focus on character names, locations, organizations, and specific terminology.
   - Include common variations or abbreviations in the "keys" array.


4. LLM Compatibility:
   - Keep the total length concise.
   - Ensure the "Name" field strictly follows the \`Target (Source)\` format.
   - Maintain consistent formatting for reliable parsing.

Expected JSON Structure:
{
  "entries": [
    {
      "keys": ["${sourceLang} string 1", "${sourceLang} string 2"],
      "value": "[category] Name: ${targetLang} Term (${sourceLang} Term) | Attribute: Value | ..."
    }
  ]
}

Example Output:

{
  "entries": [
    {
      // Example: Chinese -> English
      "keys": ["李云", "阿云"],
      "value": "[character] Name: Li Yun (李云) | Gender: Male | Role: Protagonist | Tone: Casual"
    },
    {
      // Example: English -> Spanish
      "keys": ["The Whispering Woods", "Whispering Woods"],
      "value": "[location] Name: El Bosque Susurrante (The Whispering Woods) | Atmósfera: Siniestra | Tipo: Bosque encantado"
    },
    {
      // Example: Japanese -> Korean
      "keys": ["佐藤社長", "佐藤さん"],
      "value": "[character] Name: 사토 사장님 (佐藤社長) | 성별: 남성 | 직위: 회사 대표 | 호칭: 존댓말 (Formal)"
    },
    {
      // Example: French -> German
      "keys": ["L'Épée de Vérité"],
      "value": "[item] Name: Das Schwert der Wahrheit (L'Épée de Vérité) | Genus: Neutrum | Typ: Magische Waffe"
    },
    {
      // Example: English -> Russian
      "keys": ["Black Citadel"],
      "value": "[organization] Name: Чёрная Цитадель (Black Citadel) | Род: Женский | Описание: Военная база"
    }
  ]
}

Output only the JSON, without any commentary.

You will be provided the raw text delimited with <text> XML tags.
`.trim();

    const user = `
<text>\n${text}\n</text>
`.trim();

    return { system, user };
  },
};
