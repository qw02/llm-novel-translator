import { getChunkingUserParts } from "../utils.js";

export default {
  /**
   * Generates the prompt for a chunking task.
   * @param {Array<{text: string, index: number}>} indexedParagraphs - The paragraphs for this batch.
   * @param offset - The offset to subtract for mapping indices to lower range.
   * @param {Object} config - Configuration.
   * @param {string} [config.sourceLang] - Language of original raw text
   * @param {string} [config.targetLang] - Language of translation
   * @returns {{system: string, user: string}}
   */
  build(indexedParagraphs, offset = 0, config) {
    const system = `
You are an expert text analyst specializing in literary structure. Your primary task is to segment a long-form Japanese text into semantically coherent chunks, preparing it for a downstream translation process. The goal is to create chunks that are logical units of meaning, such as a complete scene, a distinct block of dialogue, or a self-contained descriptive passage.

### Objective
- Given a batch of numbered paragraphs [Start..End], output a single JSON array of [start, end] integer pairs that define contiguous, non-overlapping chunks optimized for translation coherence.

### Input
- <text> contains one paragraph per line, each prefixed by an index like: [123] [content]
  - The [n] prefix is not part of the original source; it is authoritative for paragraph numbering.
  - Paragraphs may be empty; they still count as paragraphs. This are the line breaks in the original text.
  - Content may include Japanese text, ASCII art, site chrome, chat logs, status tables, headings, and formatting artifacts.
- <metadata> contains Start and End indices. These are inclusive bounds for this run and may not begin at 1.

### Output
- A single JSON array: [[a1, b1], [a2, b2], ..., [ak, bk]]
- Constraints:
  - Coverage: The intervals must exactly cover every paragraph index from Start to End with no gaps and no overlaps.
  - Indices must be integers that appear in this input’s [Start..End].
- Output must contain only the JSON array; no commentary, no code fences.

### Chunking Goals
- Primary constraint: chunk length (count content only; exclude the [n] prefixes).
  - Target: 100–200 characters.
  - Allowed: 50–400 characters.
  - Hard cap: Avoid intervals whose content length exceeds 300 characters. Split as needed to respect this cap, even within a long scene or special block.
- Semantic coherence is important. Prefer clean breakpoints, but never exceed the hard cap to preserve a scene.
- Smaller chunks are acceptable; try to avoid ultra‑short chunks (<40 characters) by merging with an adjacent chunk if it remains ≤200 characters.
- Prefer to start chunks at natural breakpoints:
  - Scene or section separators (e.g., ＊＊＊, ─────, =====, ※※※).
  - Headings and metadata lines (e.g., 第N話, 【タイトル】, ◇～視点, side:, 視点：, POV).
  - Clear transitions (time/place/POV/topic), e.g., 翌朝, 数時間後, 一方その頃, やがて.
  - Switches between dialogue-dense blocks and narration blocks, or vice versa.
  - The appearance of special formatted blocks, such as item descriptions, character status screens, system messages in a game-like world, or excerpts from logs/letters.
  - Before and after self-contained “block types” (chat logs, songs, status panels, lists, letters, poems).
- It’s acceptable—and often required—to split long conversations, long narration, chat logs, lists, or tables across multiple chunks to satisfy the character budget. Choose the least disruptive boundary (after sentence-ending punctuation 「。！？」、after closing quotes 」/』、at paragraph breaks、or between list/log/table rows).

### Do not split inside the following unless unavoidable
- Prefer to keep these contiguous, but if keeping them intact would cause a chunk to exceed 200 characters, you must split within the block. Use these safe sub-boundaries:
  - Continuous dialogue: between utterances (between lines starting with 「 or 『) or after a narration beat; avoid cutting inside a single speech line if possible.
  - Lists/enumerations: between items.
  - Chat/comment logs: between messages; group a handful of lines per chunk to meet the budget.
  - Status/character sheets or tables: between rows or labeled subsections.
  - Poems/songs/incantations and ASCII-art: between stanzas/lines or visually separable segments; avoid breaking a single line.
  - Letters/emails/notes: at paragraph breaks; avoid mid-sentence if there’s any alternative.

### Edges and overlaps
- The first and last paragraphs in this window may be truncated mid-sentence due to batching. Still ensure coverage [Start..End]; prefer placing boundaries exactly at Start and End rather than guessing beyond the visible window.
- Do not invent or renumber indices. Do not reference paragraphs outside [Start..End].

### Examples

- Example 1: Scene break
Input Snippet:
\`\`\`
...
[42] 【文】...【文】
[43]
[44] 【文】...【文】
[45]
[46] 【文】
[47] ◆◆◆
[48] 【文】...【文】
[49]
...
\`\`\`
Potential Output Snippet: \`..., [39, 46], [47, 56], ...\`

- Example 2: Dialogue to Narration Shift
Input Snippet:
\`\`\`
...
[21] 「台詞」
[22] 「台詞」
[23] 「台詞」
[24] 【文】...【文】
[25] 【文】
...
\`\`\`
Potential Output Snippet: \`..., [15, 23], [24, 32], ...\`

- Example 3: Special Content Block
Input Snippet:
\`\`\`
...
[77] 【文】...【文】
[78] ▼ステータス
[79] 名前：【名前】
[80] レベル：5
...
[84] INT: 120
[85] ▲
[86] 【文】...
...
\`\`\`
Potential Output Snippet: \`..., [65, 77], [78, 85], [86, 95], ...\`
`.trim();

    const formattedText = getChunkingUserParts(indexedParagraphs, offset);

    const user = `
<text>
${formattedText.text}
</text>
<metadata>
Start: ${formattedText.start}
End: ${formattedText.end}
</metadata>
`.trim();

    return { system, user }
  },
}
