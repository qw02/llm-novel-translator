export default {
  build(text, config) {
    const {
      precedingText = '',
      glossary,
      narrative,
      honorifics,
      nameOrder,
      customInstruction,
    } = config;

    // ========================================
    // SYSTEM PROMPT ASSEMBLY
    // ========================================

    const baseSystem = `
You are a highly skilled Japanese to English literature translator, tasked with translating text from Japanese to English. Aim to maintain the original tone, prose, nuance, and character voices of the source text as closely as possible.
Do not under any circumstances localize anything by changing the original meaning or tone, stick strictly to translating the original tone, prose and language as closely as possible to the original text.
`.trim();

    // --- Narrative Voice ---
    let narrativeInstruction = '';
    switch (narrative) {
      case 'auto':
        narrativeInstruction = `
### Narrative Voice
Determine which narrative voice (first person, third person) the text is best translated as.
`.trim();
        break;
      case 'first':
        narrativeInstruction = `
### Narrative Voice
For non-dialogue text (narration, description), default to using a first-person narrative voice unless the original raw text strongly indicates a different narrative style.
`.trim();
        break;
      case 'third':
        narrativeInstruction = `
### Narrative Voice
For non-dialogue text (narration, description), default to using a third-person narrative voice unless the original raw text strongly indicates a different narrative style.
`.trim();
        break;
      default:
        if (narrative !== undefined && narrative !== null) {
          console.warn(`[ja_en/translate] Unknown narrative setting: "${narrative}". Ignoring.`);
        }
        break;
    }

    // --- Honorifics ---
    let honorificsInstruction = '';
    switch (honorifics) {
      case 'preserve':
        honorificsInstruction = `
### Names: Honorifics
When translating names, preserve honorifics if they are present in the original text.
<example>
'花子さん' -> 'Hanako-san'
'花子様' -> 'Hanako-sama'
</example>
`.trim();
        break;
      case 'nil':
        honorificsInstruction = `
### Names: Honorifics
When translating names, drop common honorifics. You may choose to change them to a suitable English equivalent depending on the context.
<example>
'花子さん' -> 'Hanako'
'花子殿' -> 'Miss Hanako'
</example>
`.trim();
        break;
      default:
        if (honorifics !== undefined && honorifics !== null) {
          console.warn(`[ja_en/translate] Unknown honorifics setting: "${honorifics}". Ignoring.`);
        }
        break;
    }

    // --- Name Order ---
    let nameOrderInstruction = '';
    switch (nameOrder) {
      case 'ja':
        nameOrderInstruction = `
### Names: Ordering
Maintain the same Japanese name ordering (LastName-FirstName) in your English translation.
<example>
'山田太郎' -> 'Yamada Taro'
'琴 紗月' -> 'Koto Satsuki'
</example>
`.trim();
        break;
      case 'en':
        nameOrderInstruction = `
### Names: Ordering
Use English name ordering (FirstName-LastName) in your translation.
<example>
'山田太郎' -> 'Taro Yamada'
'琴 紗月' -> 'Satsuki Koto'
</example>
`.trim();
        break;
      default:
        if (nameOrder !== undefined && nameOrder !== null) {
          console.warn(`[ja_en/translate] Unknown nameOrder setting: "${nameOrder}". Ignoring.`);
        }
        break;
    }

    // Assemble system prompt
    const system = `
<instructions>
### Guiding Principles & Context Usage
Prioritize Raw Text: If you encounter any discrepancies between the provided \`<metadata>\` and the actual Japanese text, always treat the raw Japanese text as the ultimate source of truth. Ignore any metadata that directly contradicts the text itself.
Context is Crucial: Meticulously utilize the provided \`<metadata>\` (character information, glossary, dictionary) and the preceding lines. This combined context is vital for:
- Maintaining consistency in terminology and characterization.
- Understanding character relationships and the flow of conversation.
- Resolving ambiguities in meaning.
- Inferring the subjects in the sentences, which are often omitted in Japanese by closely examining the preceding few sentences

### Core Translation Directives
Tone and Style Preservation: Faithfully replicate the original author's style and the specific tone of the scene (e.g., humorous, dramatic, romantic, tense).
Dialogue Handling:
- Dialogue lines are enclosed in Japanese quotation marks (e.g., 「 」, 『 』).
- Use the preceding lines and metadata to determine who is speaking the current dialogue line. Assume speakers often alternate in back-and-forth conversation unless context indicates otherwise.
- In the translation, replace them with smart quotation marks (“”).
Pronoun Usage:Ensure correct English pronouns (he, she, it, they, etc.) are used. You should use character information from metadata if they are available.
Narrative Voice: ${narrativeInstruction}
Interpret Parentheses: Text within parentheses \`()\` might originate from HTML ruby annotations (furigana) or be authorial asides. Interpret their function contextually. Omit them in the translation, if they are purely phonetic (furigana).
Natural English: Prioritize fluent, natural-sounding English. Avoid overly literal translations. Adapt sentence structure as needed while preserving meaning and intent.

### Names
${honorificsInstruction}
${nameOrderInstruction}

### Input Format
The text you need to translate are enclosed in <raw-text></raw-text> tags. If they exist, the previous few lines immediately before are provided inside <previous-text></previous-text> tags.
The XML tags are NOT part of the text, and you should not repeat them in your response.

### Output Format
Translation Encapsulation: You MUST place your translated English sentence(s) with \`<translation>\` and \`</translation>\` tags. The extraction script relies strictly on this format.
<example>
- **Input is Dialogue**
Input: \`「ただいま戻りました」\`
Output: <translation>“I have returned.”</translation>
- **Input is Narration/Description**
Input: \`空は青く澄み渡っていた。\`
Output: <translation>The sky was clear and blue.</translation>
</example>
Line Correspondence: As a general guideline, aim to preserve the line structure of the original text. The number of lines in your translation should correspond to the number of lines in the input. This is not an inflexible rule; if merging or splitting lines results in a more natural or accurate translation, please use your best judgment.

For non-Japanese text, simply repeat them back as it is. Your response will be used to replace the original text by a script.
<example>
Input: \`==--==--==\`
Output: <translation> ==--==--== <translation>
</example>
</instructions>
`.trim();

    // ========================================
    // USER PROMPT ASSEMBLY
    // ========================================

    const fullContextText = precedingText + text;

    // --- Glossary Metadata ---
    let glossaryMetadata = '';
    if (glossary && Object.keys(glossary).length > 0) {
      const relevantEntries = Object.entries(glossary)
        .filter(([key]) => fullContextText.includes(key))
        .map(([key, val]) => `${key} -> ${val.translation || val}`)
        .join('\n');

      if (relevantEntries) {
        glossaryMetadata = `
### Glossary
Use the following translations consistently:
${relevantEntries}
`.trim();
      }
    }

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
      `Translate the following Japanese text into English:\n<raw-text>\n${text}\n</raw-text>`,
    ].filter(Boolean);

    const user = userParts.join('\n\n');

    return { system, user };
  },
};