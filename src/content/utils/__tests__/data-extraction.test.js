// ./__test__/utils.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseJSONFromLLM, extractTextFromTag } from '../data-extraction.js';

describe('parseJSONFromLLM', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('parses JSON from ```json fenced block (Strategy 1)', () => {
    const input = `
Intro text
\`\`\`json
{ "a": 1, "b": [2] }
\`\`\`
Footer text
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ a: 1, b: [2] });
  });

  it('ignores malformed ```json block and continues to other strategies', () => {
    const input = `
\`\`\`json
{ "a": 1,   // this is illegal JSON comment
\`\`\`

And then a valid fence follows:

\`\`\`
{ "x": 42 }
\`\`\`
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ x: 42 });
  });

  it('parses JSON from any fenced block without language (Strategy 2)', () => {
    const input = `
Some chatter
\`\`\`
{ "name": "Kasumi", "age": 20 }
\`\`\`
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ name: 'Kasumi', age: 20 });
  });

  it('removes line and block comments inside fenced content before parsing (Strategy 2 comment cleaning)', () => {
    const input = `
\`\`\`ts
{
  // line comment
  "ok": true, /* block comment */
  "tags": ["a", "b"] // trailing line
}
\`\`\`
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ ok: true, tags: ['a', 'b'] });
  });

  it('tries all fenced blocks and picks the first that parses', () => {
    const input = `
\`\`\`js
{ invalid: becauseNoQuotes: 1 }
\`\`\`
Noise between
\`\`\`python
# not JSON at all
print("hello")
\`\`\`
More noise
\`\`\`
{ "rescue": true, "n": 3 }
\`\`\`
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ rescue: true, n: 3 });
  });

  it('extracts balanced JSON object from raw text when no fences exist (Strategy 3)', () => {
    const input = `
The model said something like:
Here is your data:
{ "alpha": 1, "beta": { "gamma": [1,2,3] } } and then more chatter.
End.
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ alpha: 1, beta: { gamma: [1, 2, 3] } });
  });

  it('extracts balanced JSON array from raw text when no fences exist (Strategy 3)', () => {
    const input = `
Artifacts: [ { "id": 1 }, { "id": 2 } ] trailing words here
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('handles quotes, escapes, and braces inside strings when extracting balanced JSON', () => {
    const input = `
Random preface
{ "text": "A brace in a string: } and a quote: \\" and a backslash: \\\\", "ok": true }
Trailing stuff
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({
      text: 'A brace in a string: } and a quote: " and a backslash: \\',
      ok: true,
    });
  });

  it('removes comments from extracted JSON (Strategy 3 comment cleaning)', () => {
    const input = `
Start
{ 
  "a": 1, // line comment
  "b": /* block */ 2
}
Finish
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('returns empty object and logs an error when no JSON can be found', () => {
    const input = `No JSON here, only plain words and maybe a colon: but no braces.`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const [[message]] = consoleErrorSpy.mock.calls;
    expect(message).toContain('No valid JSON found in LLM output');
  });

  it('handles unmatched fences by treating end-of-string as fence end (Strategy 2 regex supports $)', () => {
    const input = `
\`\`\`
{ "last": true }
`; // note: no closing fence
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ last: true });
  });

  it('Strategy priority: prefers fenced ```json over later raw extraction', () => {
    const input = `
\`\`\`json
{ "priority": "json-fence" }
\`\`\`

Chatter with another object { "priority": "raw" } end
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ priority: 'json-fence' });
  });

  it('Strategy priority: generic fence before raw extraction when json fence absent', () => {
    const input = `
Chatter
\`\`\`
{ "pick": "generic-fence" }
\`\`\`
And then some { "pick": "raw" } later
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ pick: 'generic-fence' });
  });

  it('ignores comments inside string literals (does not strip within quotes)', () => {
    const input = `
\`\`\`
{ "note": "this is not // a comment, nor /* a block */", "v": 1 }
\`\`\`
`;
    // The parser strips comments before JSON.parse, but the regex-based stripping
    // targets //... and /*...*/. Those sequences inside quotes are preserved by JSON.parse,
    // because the comment stripping occurs before, but doesn't affect the quoted content
    // as they are part of the string. This test ensures final value remains intact.
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({
      note: 'this is not // a comment, nor /* a block */',
      v: 1,
    });
  });

  it('handles multiple fenced blocks and returns the first successfully parsed one', () => {
    const input = `
\`\`\`json
{ "bad": 1, }  // trailing comma breaks JSON
\`\`\`
\`\`\`md
- not json
\`\`\`
\`\`\`
{ "ok": true }
\`\`\`
\`\`\`json
{ "late": true }
\`\`\`
`;
    const result = parseJSONFromLLM(input);
    expect(result).toEqual({ ok: true });
  });
});

describe('extractTextFromTag', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('extracts content from a single balanced tag pair', () => {
    const input = 'xxx<data>abc</data>xxx';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('abc');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('extracts and joins multiple balanced occurrences with new lines', () => {
    const input = '<data>aaa</data>\n<data>bbb</data>';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('aaa\nbbb');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('trims inner content for each matched segment', () => {
    const input = '<data>\n  hello  \n</data><data>  world</data>';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('hello\nworld');
  });

  it('returns content after opening tag when last closing tag is missing (recovery: missing last closing)', () => {
    const input = 'xxx<data>aaa';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('aaa');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const [[message]] = consoleWarnSpy.mock.calls;
    expect(message).toContain('Missing last closing tag </data>');
  });

  it('returns ### and warns when no tags are found', () => {
    const input = 'no tags here';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('###');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('No tags <data> found.');
  });

  it('escapes special regex characters in the tag name', () => {
    const input = '<a.b>hello</a.b><a.b>world</a.b>';
    const result = extractTextFromTag(input, 'a.b');
    expect(result).toBe('hello\nworld');
  });

  it('does not greedily span across multiple pairs because of (.*?) with s flag', () => {
    const input = '<data>first</data> junk <data>second</data>';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('first\nsecond');
  });

  it('leaves angle-bracket-like text inside content untouched', () => {
    const input = '<data>{"note":"a < b and c > d"}</data>';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('{"note":"a < b and c > d"}');
  });

  it('works when the tag content contains nested same-tag-looking text but not actual tags', () => {
    const input = '<data>start <data> not a tag, just text </data> end</data>';
    const result = extractTextFromTag(input, 'data');
    // The inner "</data>" text will terminate the match; because regex is non-greedy,
    // it captures "start <data> not a tag, just text " up to the first true closing tag.
    expect(result).toBe('start <data> not a tag, just text');
  });

  it('handles leading and trailing whitespace around matched segments and preserves join as new line', () => {
    const input = '  <data>  alpha </data>  \n  <data>\n beta\n</data>  ';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('alpha\nbeta');
  });

  it('case sensitivity: only exact tag name matches', () => {
    const input = '<Data>UPPER</Data><data>lower</data>';
    const result = extractTextFromTag(input, 'data');
    // Only the lowercase pair should be matched, since regex is case-sensitive
    expect(result).toBe('lower');
  });

  it('when counts indicate missing last closing with lots of text after, returns tail correctly', () => {
    const input = 'preamble <data>alpha</data> middle <data>beta</data> trailer <data>gamma and more text';
    const result = extractTextFromTag(input, 'data');
    expect(result).toBe('alpha\nbeta\ngamma and more text');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toContain('Missing last closing tag </data>');
  });

});