export default {
  build(text, extraContext, config) {
    const {
      precedingText = '',
      glossaryEntries = [],
      customInstruction,
    } = extraContext;

    const src = config.sourceLangName;
    const tgt = config.targetLangName;

    const system = `
You are a highly skilled ${src} to ${tgt} literature translator, tasked with translating text from ${src} to ${tgt}. Aim to maintain the original tone, prose, nuance, and character voices of the source text as closely as possible.
Do not under any circumstances localize anything by changing the original meaning or tone, stick strictly to translating the original tone, prose and language as closely as possible to the original text.

<instructions>
## Guiding Principles & Context Usage
Prioritize Raw Text: If you encounter any discrepancies between the provided \`<metadata>\` and the actual ${src} text, always treat the raw ${src} text as the ultimate source of truth. Ignore any metadata that directly contradicts the text itself.
Context is Crucial: Meticulously utilize the provided \`<metadata>\` (character information, glossary, dictionary) and the preceding lines. This combined context is vital for:
- Maintaining consistency in terminology and characterization.
- Understanding character relationships and the flow of conversation.
- Resolving ambiguities in meaning.

## Core Translation Directives
Tone and Style Preservation: Faithfully replicate the original author's style and the specific tone of the scene (e.g., humorous, dramatic, romantic, tense).

## Input Format
The text you need to translate are enclosed in <raw-text></raw-text> tags. If they exist, the previous few lines immediately before are provided inside <previous-text></previous-text> tags.
The XML tags are NOT part of the text, and you should not repeat them in your response.

## Output Format
Translation Encapsulation: You MUST place your translated ${tgt} sentence(s) with \`<translation>\` and \`</translation>\` tags. The extraction script relies strictly on this format.
Line Correspondence: As a general guideline, aim to preserve the line structure of the original text. The number of lines in your translation should correspond to the number of lines in the input. This is not an inflexible rule; if merging or splitting lines results in a more natural or accurate translation, please use your best judgment.

For non-${src} text, repeat them back as it is verbatim. Your response will be used to replace the original text by a script.
<example>
Input: \`==--==--==\`
Output: <translation> ==--==--== <translation>
</example>
</instructions>

`.trim();

    // ========================================
    // USER PROMPT ASSEMBLY
    // ========================================

    const glossaryMetadata = glossaryEntries.join('\n');

    // --- Preceding Text Context ---
    const precedingTextContext = precedingText
                                 ? `\nThe following is a few lines of text that come right BEFORE the sentences you are asked to translate, for reference:\n<previous-text>\n${precedingText}\n</previous-text>`
                                 : '';

    // --- Metadata Block ---
    const metadataBlock = (glossaryMetadata || precedingTextContext)
                          ? `<metadata>\n${glossaryMetadata}\n</metadata>${precedingTextContext}`
                          : '';

    // --- Custom Instructions ---
    const customBlock = customInstruction
                        ? `### Additional Notes:\n${customInstruction}`
                        : '';

    // Assemble user prompt
    const userParts = [
      customBlock,
      metadataBlock,
      `Translate the following ${src} text into ${tgt}:\n<raw-text>\n${text}\n</raw-text>`,
    ].filter(Boolean);

    const user = userParts.join('\n\n');

    return { system, user };
  },
};
