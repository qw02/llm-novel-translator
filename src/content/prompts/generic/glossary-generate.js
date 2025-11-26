export default {
  build(text, config) {
    const sourceLang = config.sourceLang;
    const targetLang = config.targetLang;

    const system = `
You are generating entries for a multi-key dictionary that will be used as the knowledge base for a RAG pipeline in a ${sourceLang} to ${targetLang} LLM translation task. This metadata part will be used to help ensure consistency in the translation of names, proper nouns, and specific terminology across multiple API calls. In the RAG pipeline, the text to be translated will be scanned, and the presence of any string in the "keys" array will result in the content of "value" being included in the LLM context.

Rules and Guidelines:
1. Output Format:
   - Generate a JSON structure with an "entries" array.
   - Each entry should contain "keys" (array of ${sourceLang} terms/names/variations) and "value" (structured metadata string).

2. Value String Format:
   - Start with a category in square brackets (e.g., [character], [location], [organization], [term], [item]).
   - Follow with "Key: Value" pairs separated by " | " (space, pipe, space).
   - **CRITICAL NAME FORMAT**: The first key-value pair must be the Name. Write the full ${targetLang} translation first, followed by the original ${sourceLang} version in parentheses.
     - Format: \`[category] Name: <${targetLang} Translation> (<${sourceLang} Original>) | ...\`
   - Always include gender information for characters (Male, Female, Neutral/Unknown) as this is vital for grammatical correctness in many target languages.
   - Include specific instructions (e.g., Tone, Formality) if relevant to the ${targetLang}.

3. Entry Selection Criteria:
   - Focus on character names, location names, organization names, and specific terminology (fantasy/sci-fi/technical terms).
   - Exclude generic common nouns unless they have a specific, non-standard translation in this context.
   - Include common variations, abbreviations, or nicknames in the "keys" array to ensure the RAG system catches them.

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

Example Output (demonstrating various language pairs):

{
  "entries": [
    {
      // Example: Chinese -> English (Character with nickname)
      "keys": ["李云", "阿云"],
      "value": "[character] Name: Li Yun (李云) | Gender: Male | Nickname: Ah Yun (阿云)"
    },
    {
      // Example: English -> Spanish (Location)
      "keys": ["The Whispering Woods", "Whispering Woods"],
      "value": "[location] Name: El Bosque Susurrante (The Whispering Woods) | Mood: Ominous"
    },
    {
      // Example: Japanese -> Korean (Organization)
      "keys": ["魔法省", "日本魔法省"],
      "value": "[organization] Name: 마법성 (魔法省) | Type: Government Body"
    },
    {
      // Example: French -> German (Technical/Fantasy Term)
      "keys": ["L'Épée de Vérité"],
      "value": "[item] Name: Das Schwert der Wahrheit (L'Épée de Vérité) | Gender: Neuter (German)"
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
