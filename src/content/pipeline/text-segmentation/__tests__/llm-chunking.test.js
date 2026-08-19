import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the LLM parser module used by the implementation.
vi.mock("../../../utils/data-extraction.js", () => {
  return {
    parseJSONFromLLM: vi.fn(),
  };
});

// Import the mocked function to set return values per test.
import { parseJSONFromLLM } from "../../../utils/data-extraction.js";

// Import functions under test.
import {
  getIntervalsFromLLMOrFallback,
  makeFallbackIntervals,
  enforceMinChunkSize,
} from "../llm-chunking.js";


/** Helpers for tests */

// Generate contiguous, non-overlapping [s, e] pairs with a fixed step.
function genStepIntervals(start, end, step) {
  const out = [];
  for (let s = start; s <= end; s += step) {
    out.push([s, Math.min(s + step - 1, end)]);
  }
  return out;
}

describe("makeFallbackIntervals", () => {
  it("splits [start, end] into 5-paragraph chunks by default", () => {
    const got = makeFallbackIntervals(31, 42);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("respects a custom step size", () => {
    const got = makeFallbackIntervals(1, 10, 3);
    expect(got).toEqual([
      [1, 3],
      [4, 6],
      [7, 9],
      [10, 10],
    ]);
  });

  it("throws on invalid bounds", () => {
    expect(() => makeFallbackIntervals(10, 9)).toThrow();
    expect(() => makeFallbackIntervals(1.5, 10)).toThrow();
    expect(() => makeFallbackIntervals(1, 10.2)).toThrow();
  });
});

describe("getIntervalsFromLLMOrFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed intervals when valid and contiguous", () => {
    const start = 31, end = 42;
    const valid = [
      [31, 35],
      [36, 40],
      [41, 42],
    ];
    parseJSONFromLLM.mockReturnValue(valid);

    const got = getIntervalsFromLLMOrFallback("ok", start, end);
    expect(got).toEqual(valid);
  });

  it("accepts unsorted intervals and returns normalized sorted output", () => {
    const start = 31, end = 42;
    const unsorted = [
      [41, 42],
      [31, 35],
      [36, 40],
    ];
    parseJSONFromLLM.mockReturnValue(unsorted);

    const got = getIntervalsFromLLMOrFallback("ok", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when parser returns {} (unreadable)", () => {
    const start = 31, end = 42;
    parseJSONFromLLM.mockReturnValue({});

    const got = getIntervalsFromLLMOrFallback("bad", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when the parser throws", () => {
    const start = 50, end = 62;
    parseJSONFromLLM.mockImplementation(() => {
      throw new Error("parse error");
    });

    const got = getIntervalsFromLLMOrFallback("err", start, end);
    expect(got).toEqual([
      [50, 54],
      [55, 59],
      [60, 62],
    ]);
  });

  it("falls back when there is a gap between intervals", () => {
    const start = 31, end = 42;
    const gappy = [
      [31, 33],
      [35, 40], // gap at 34
      [41, 42],
    ];
    parseJSONFromLLM.mockReturnValue(gappy);

    const got = getIntervalsFromLLMOrFallback("gap", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when intervals overlap or touch improperly", () => {
    const start = 31, end = 42;
    const overlapping = [
      [31, 36],
      [36, 40], // not contiguous: next.start must equal prev.end + 1
      [41, 42],
    ];
    parseJSONFromLLM.mockReturnValue(overlapping);

    const got = getIntervalsFromLLMOrFallback("overlap", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when coverage does not start at the required start", () => {
    const start = 31, end = 42;
    const wrongStart = [
      [32, 35],
      [36, 40],
      [41, 42],
    ];
    parseJSONFromLLM.mockReturnValue(wrongStart);

    const got = getIntervalsFromLLMOrFallback("wrong-start", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when coverage does not end at the required end", () => {
    const start = 31, end = 42;
    const wrongEnd = [
      [31, 35],
      [36, 40],
      [41, 41],
    ];
    parseJSONFromLLM.mockReturnValue(wrongEnd);

    const got = getIntervalsFromLLMOrFallback("wrong-end", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("falls back when any interval runs outside [start, end]", () => {
    const start = 31, end = 42;
    const outOfRange = [
      [30, 35], // s < start
      [36, 40],
      [41, 42],
    ];
    parseJSONFromLLM.mockReturnValue(outOfRange);

    const got = getIntervalsFromLLMOrFallback("oor", start, end);
    expect(got).toEqual([
      [31, 35],
      [36, 40],
      [41, 42],
    ]);
  });

  it("uses the custom fallback size when provided", () => {
    const start = 1, end = 10;
    parseJSONFromLLM.mockReturnValue({}); // force fallback

    const got = getIntervalsFromLLMOrFallback("x", start, end, { fallbackSize: 3 });
    expect(got).toEqual(genStepIntervals(1, 10, 3));
  });

  it("handles a long span using a generator-produced valid segmentation", () => {
    const start = 100, end = 160;
    const valid = genStepIntervals(start, end, 7); // arbitrary step
    parseJSONFromLLM.mockReturnValue(valid);

    const got = getIntervalsFromLLMOrFallback("ok", start, end);
    expect(got).toEqual(valid);
  });
});
describe("enforceMinChunkSize", () => {
  // Build paragraphs where each paragraph is `len` chars long
  function makeTexts(lengths) {
    return lengths.map((len, i) => ({
      id: `p${i}`,
      index: i,
      text: "x".repeat(len),
    }));
  }

  it("returns input unchanged when minChars is 0 or negative", () => {
    const texts = makeTexts([1, 1, 1]);
    const intervals = [[1, 1], [2, 2], [3, 3]];
    expect(enforceMinChunkSize(intervals, texts, 0)).toEqual(intervals);
    expect(enforceMinChunkSize(intervals, texts, -5)).toEqual(intervals);
  });

  it("returns a single interval unchanged even if below the minimum", () => {
    const texts = makeTexts([5, 5]);
    const intervals = [[1, 2]];
    expect(enforceMinChunkSize(intervals, texts, 100)).toEqual(intervals);
  });

  it("leaves chunks untouched when all meet the minimum", () => {
    const texts = makeTexts([50, 50, 50]);
    const intervals = [[1, 1], [2, 2], [3, 3]];
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual(intervals);
  });

  it("merges a too-small chunk forward with the next interval", () => {
    // chunk [1,1] has 10 chars < 40, so it absorbs [2,2]
    const texts = makeTexts([10, 50, 50]);
    const intervals = [[1, 1], [2, 2], [3, 3]];
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual([[1, 2], [3, 3]]);
  });

  it("keeps merging forward while the accumulated chunk stays below the minimum", () => {
    // [1,1]=10 absorbs [2,2] (=20) still < 40, absorbs [3,3] (=30+10+... ) now 70 >= 40
    const texts = makeTexts([10, 10, 50, 50]);
    const intervals = [[1, 1], [2, 2], [3, 3], [4, 4]];
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual([[1, 3], [4, 4]]);
  });

  it("allows the merged chunk to exceed any max range", () => {
    const texts = makeTexts([5, 500]);
    const intervals = [[1, 1], [2, 2]];
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual([[1, 2]]);
  });

  it("merges a too-small final chunk into the previous one", () => {
    // [3,3] has 10 chars < 40 and has no successor -> merge into previous
    const texts = makeTexts([50, 50, 10]);
    const intervals = [[1, 1], [2, 2], [3, 3]];
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual([[1, 1], [2, 3]]);
  });

  it("handles several small chunks in a row including the tail", () => {
    const texts = makeTexts([50, 10, 10, 10]);
    const intervals = [[1, 1], [2, 2], [3, 3], [4, 4]];
    // [2,2] small -> absorbs [3,3] (20 < 40) -> absorbs [4,4] (30 < 40),
    // still below min at the tail -> merged into [1,1]
    expect(enforceMinChunkSize(intervals, texts, 40)).toEqual([[1, 4]]);
  });

  it("does not mutate the input intervals", () => {
    const texts = makeTexts([10, 50]);
    const intervals = [[1, 1], [2, 2]];
    const copy = intervals.map(iv => [...iv]);
    enforceMinChunkSize(intervals, texts, 40);
    expect(intervals).toEqual(copy);
  });
});
