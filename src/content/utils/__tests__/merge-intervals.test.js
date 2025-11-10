import { describe, it, expect } from 'vitest';
import { mergeChunkIntervals } from '../merge-intervals.js';

const expectContinuous = (intervals) => {
  for (let i = 0; i < intervals.length - 1; i++) {
    expect(intervals[i][1] + 1).toBe(intervals[i + 1][0]);
  }
};

describe('mergeChunkIntervals', () => {
  it('passes through a single list unchanged (and remains continuous)', () => {
    const input = [[1, 5], [6, 8]];
    const out = mergeChunkIntervals(input);

    expect(out).toEqual([[1, 5], [6, 8]]);
    expect(out[0][0]).toBe(1);
    expect(out[out.length - 1][1]).toBe(8);
    expectContinuous(out);
  });

  it('merges multiple lists: preserves global start/end and continuity', () => {
    const L0 = [[1, 5], [6, 10], [11, 15], [16, 20]];
    const L1 = [[14, 18], [19, 25], [26, 30]];
    const L2 = [[28, 32], [33, 40]];

    const out = mergeChunkIntervals([L0, L1, L2]);

    // Global start/end should match first and last list boundaries
    expect(out[0][0]).toBe(L0[0][0]); // start at 1
    expect(out[out.length - 1][1]).toBe(L2[L2.length - 1][1]); // end at 40

    // Output is continuous
    expectContinuous(out);
  });

  it('preserves non-overlapping internal boundaries from the left region', () => {
    // Overlap between L0 and L1 starts at 14, so 5 and 10 are non-overlapping boundaries
    const L0 = [[1, 5], [6, 10], [11, 15], [16, 20]];
    const L1 = [[14, 18], [19, 25], [26, 30]];
    const L2 = [[28, 32], [33, 40]];

    const out = mergeChunkIntervals([L0, L1, L2]);

    const ends = new Set(out.map(i => i[1]));
    expect(ends.has(5)).toBe(true);
    expect(ends.has(10)).toBe(true);
  });

  it('preserves non-overlapping internal boundaries from the right region', () => {
    // Overlap between L1 and L2 is 28..30, so boundaries 32 (end) and 33 (start) should remain
    const L0 = [[1, 5], [6, 10], [11, 15], [16, 20]];
    const L1 = [[14, 18], [19, 25], [26, 30]];
    const L2 = [[28, 32], [33, 40]];

    const out = mergeChunkIntervals([L0, L1, L2]);

    const ends = new Set(out.map(i => i[1]));
    const starts = new Set(out.map(i => i[0]));

    expect(ends.has(32)).toBe(true);
    expect(starts.has(33)).toBe(true);
  });

  it('handles single-paragraph overlaps while preserving non-overlap boundaries', () => {
    // Overlap at exactly paragraph 9
    const L0 = [[1, 4], [5, 9]];
    const L1 = [[9, 12], [13, 15]];

    const out = mergeChunkIntervals([L0, L1]);

    // Global start/end
    expect(out[0][0]).toBe(1);
    expect(out[out.length - 1][1]).toBe(15);

    // Continuous
    expectContinuous(out);

    // Non-overlapping boundaries: 4 (left), 13 (right) remain
    const ends = new Set(out.map(i => i[1]));
    const starts = new Set(out.map(i => i[0]));
    expect(ends.has(4)).toBe(true);
    expect(starts.has(13)).toBe(true);
  });

  it('works across several adjacent overlaps and preserves clean interior boundaries', () => {
    const L0 = [[1, 3], [4, 6]];
    const L1 = [[6, 8], [9, 12]];
    const L2 = [[12, 14], [15, 16]];
    const L3 = [[16, 18], [19, 20]];

    const out = mergeChunkIntervals([L0, L1, L2, L3]);

    // Global start/end
    expect(out[0][0]).toBe(1);
    expect(out[out.length - 1][1]).toBe(20);

    // Continuous
    expectContinuous(out);

    // Non-overlapping internal boundaries that should remain:
    // - 3 (end in L0 before the L0/L1 overlap at 6)
    // - 9 (start in L1 away from overlaps at 6 and 12)
    // - 18 (end in L3 after its overlap at 16)
    const ends = new Set(out.map(i => i[1]));
    const starts = new Set(out.map(i => i[0]));
    expect(ends.has(3)).toBe(true);
    expect(starts.has(9)).toBe(true);
    expect(ends.has(18)).toBe(true);
  });
});