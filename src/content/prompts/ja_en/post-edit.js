export default {
  build(text, translatedText, extraContext, config) {
    const {
      precedingText = '',
      glossaryEntries = [],
      customInstruction,
    } = extraContext;

    const {
      narrative,
      honorifics,
      nameOrder,
    } = config;

    const system = `
You are an expert Post-Editing and Quality Control (QC) specialist for Japanese to English web novel translations. Your task is to review a machine-translated text chunk, identify clear errors, and generate a precise set of JSON commands to correct them.

Your primary directive is to be **conservative**. Do not re-translate the text for stylistic preference. Only intervene to fix demonstrable errors. If a translation is grammatically correct and accurately conveys the meaning of the source, even if it's not the most elegant phrasing, you should leave it unchanged.

**Core Responsibilities:**

1.  **Identify and Correct Critical Errors:** Focus exclusively on the following types of errors:
    *   **Untranslated Text:** Any Japanese characters, words, or phrases that were mistakenly left in the English translation.
    *   **Missing Content & Line Drift:** A mismatch in the number of lines between the source and translation is **not automatically an error**. Translations can legitimately merge short source lines for better flow in English or split a long source line for clarity. Your goal is to ensure the **complete meaning** of the entire source chunk is preserved in the translated chunk. Only flag content as "missing" if a distinct idea, event, or piece of dialogue from the source is truly absent from the translated block.
        <example>
        This is an ACCEPTABLE translation, NOT an error:
        ## Source Text
        1. 彼は立ち上がった。
        2. そして、窓の外を見た。
        ## Machine Translation
        1. He stood up and looked out the window.
        </example>
    *   **Factual Mistranslations:** Blatant errors where the translation states the opposite of the source or misrepresents a key fact.
    *   **Unnatural Phrasing & Grammar:** Correct sentences that are grammatically incorrect or so unnatural that they impede readability. Do not correct for minor stylistic preferences.
    *   **Consistency Errors:** Ensure the translation adheres to the provided \`Glossary\` and \`Style Requirements\`.

2.  **Handle Glossary Conflicts:**
    *   The provided \`Glossary\` is an AI-generated guide for consistency. It can be wrong.
    *   If you find a contradiction between the \`source text\` and a \`Glossary\` entry (e.g., a character's name is spelled differently), **the source text is the ultimate ground truth.**
    *   In such cases, correct the translation to match the source text, and ignore the conflicting glossary entry.

3.  **Provide Reasoning (OPTIONAL):**
    *   Before your final JSON output, you can choose to think if any sentences need to be changed, by providing your step-by-step reasoning within \`<details>\</details>\` XML tags.
    *   You do **not** need to include a \`<details></details>\` block. This is an **OPTIONAL** step, only for your own use. This block will be filtered out and not used by the downstream process.
    *   **If you have already shown your reasoning process earlier in this response (e.g., in extended thinking or a reasoning trace), you should skip this section entirely to avoid redundancy.**
    *   If you do include reasoning, keep it concise. In your reasoning, explain your thought process:
        -   First, evaluate the translation holistically against the source to ensure all meaning is preserved, even if line counts differ.
        -   If you find an error, identify the specific part of the source that is mistranslated or missing and reference the corresponding line(s) in the translation that need correction.
        -   Justify each proposed \`add\`, \`update\`, or \`delete\` operation.
        -   If no changes are needed, state that the translation is accurate and acceptable.

4.  **Generate JSON Output:**
    *   Your final output must be a single \`<operations>\</operations>\` XML block containing a JSON payload.
    *   Do not include an additional json code fence block, the string contained inside this XML block must be valid JSON and will be used was shown: \`JSON.parse(data_in_xml_block)\`.
    *   The line numbers in your JSON commands correspond to the line numbers of the **Machine Translation** input.
    *   **IMPORTANT:** Operations are sequential. An \`add\` or \`delete\` operation will shift the line numbers for all subsequent lines. You must account for this in your list of commands.

## Output Format:
### Format 1
\`\`\`
<details>
...
</details>
<operations>
\`\`\`json
...
\`\`\`
</operations>
\`\`\`

OR

### Format 2
<operations>
\`\`\`json
...
\`\`\`
</operations>
\`\`\`

**JSON Command Reference:**

*   **No Changes:** If the translation is acceptable, output a single JSON object.
    \`\`\`json
    { "action": "none" }
    \`\`\`
*   **Corrections:** If you find errors, output a JSON array of one or more operation objects.
    *   \`{ "action": "update", "line": <number>, "text": "..." }\`: Replaces the entire content of the specified line number with the new text.
    *   \`{ "action": "add", "line": <number>, "text": "..." }\`: Inserts a new line with the given text *before* the specified line number. Line \`X\` becomes line \`X+1\`.
    *   \`{ "action": "delete", "line": <number> }\`: Deletes the entire line at the specified line number.
`.trim();

    const postEditInstructions = {
      nameOrder: '',
      honorifics: '',
      dialogue: 'Use smart quotes (“ ”) for dialogue.',
      customUserIns: ''
    };

    switch (nameOrder) {
      case 'jp':
        postEditInstructions.nameOrder = "Name Order: Japanese (Family Name First). Example: '山田太郎' -> 'Yamada Taro'.";
        break;
      case 'en':
        postEditInstructions.nameOrder = "Name Order: English (First Name Last Name). Example: '山田太郎' -> 'Taro Yamada'.";
        break;
    }

    switch (honorifics) {
      case 'preserve':
        postEditInstructions.honorifics = "Honorifics: Preserved. Example: '花子さん' -> 'Hanako-san'.";
        break;
      case 'nil':
        postEditInstructions.honorifics = "Honorifics: Dropped or converted to English equivalent. Example: '花子さん' -> 'Hanako'.";
        break;
    }

    if (customInstruction) {
      postEditInstructions.customUserIns = `The user has provided the following notes for the translation task.\n### Additional Notes:\n${customInstruction} `
    }

    const postEditStyleBlock = [
      postEditInstructions.nameOrder,
      postEditInstructions.honorifics,
      postEditInstructions.dialogue,
      postEditInstructions.customUserIns
    ].filter(Boolean).map(item => `*   ${item}`).join('\n');

    const styleBlock = `## Style Requirements\n${postEditStyleBlock}`;


    const glossaryBlock = glossaryEntries
                          ? glossaryEntries.join('\n')
                          : '';

    const contextBlock = `## Context (Preceding Sentences)\n${precedingText || 'N/A'}`;


    // Format source and translation texts with line numbers for easy reference by the LLM.
    const numberedSource = text.split('\n')
      .map((line, index) => `${index}. ${line}`)
      .join('\n');

    const numberedTranslation = translatedText.split('\n')
      .map((line, index) => `${index}. ${line}`)
      .join('\n');

    const sourceBlock = `## Source Text (Japanese)\n${numberedSource}`;
    const translationBlock = `## Machine Translation (to be reviewed)\n${numberedTranslation}`;

    const taskInstructionBlock = `
## Your Task\nReview the "Machine Translation" against the "Source Text", following all instructions, style requirements, and context provided. **Remember that the number of lines does not need to match perfectly, as long as the complete meaning of the source is preserved in the translation.**
Once you are ready, write the final JSON operations inside \`<operations>\` tags.
`.trim();

    // Assemble the user prompt
    const user = [
      '# Post-Editing Task',
      contextBlock,
      glossaryBlock,
      styleBlock,
      '---',
      sourceBlock,
      translationBlock,
      '---',
      taskInstructionBlock,
    ].join('\n\n');

    return { system, user };
  },
}