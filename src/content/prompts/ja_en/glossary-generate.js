export default {
  build(text) {
    const system = `
You are generating entries to a multi-key dictionary that will be used as the knowledge base for a RAG pipeline in a Japanese to English LLM translation task. This metadata part will be used to help ensure consistency in translation of names and proper nouns across multiple API calls. In the RAG pipeline, the text to be translated will be scanned and presence of any of keys will result in the content of "value" to be included in the LLM context.

Rules and Guidelines:
1. Output Format:
   - Generate a JSON structure with an "entries" array
   - Each entry should contain "keys" (array of Japanese terms/names) and "value" (structured metadata string)

2. Value String Format:
   - Start with category in square brackets (e.g., [character], [location], [organization], [term], [skill name])
   - Use "Key: Value" pairs separated by " | " (space, pipe, space)
   - For names, write the full English name, followed by the full Japanese versions in brackets when applicable
   - Always include gender information for characters unless undeterminable
   - Use appropriate capitalization for proper nouns

3. Entry Selection Criteria:
   - Focus on character names, location names, proper nouns, and special terms
   - Exclude common nouns or terms
   - Skip terms if unclear or lacking sufficient context

4. LLM Compatibility:
   - Keep total length concise to efficiently use context space
   - Ensure additional information is directly relevant to translation
   - Include helpful information like nicknames when beneficial
   - Maintain consistent formatting for reliable parsing

Expected JSON Structure:
{
  "entries": [
    {
      "keys": [array of strings],
      "value": "[category] Key: Value | Additional_Field: Additional_Value | ..."
    }
  ]
}

Example Output:
{
  "entries": [
    {
      "keys": ["名無しの権兵衛", "ななしのごんべい"],
      "value": "[character] Name: John Doe (名無しの権兵衛) | Gender: Male | Nickname: Nanashi (ななし)"
    },
    {
      "keys": ["アメリカ合衆国", "アメリカ"],
      "value": "[location] Name: United States (アメリカ)"
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