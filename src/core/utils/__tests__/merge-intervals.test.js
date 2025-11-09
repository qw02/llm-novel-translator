import { describe, it, expect } from 'vitest';
import { mergeChunkIntervals } from '../merge-intervals.js';

// Helpers for assertions
const coverage = (intervals) => ({
  start: intervals[0].start,
  end: intervals[intervals.length - 1].end,
});

const isContinuous = (intervals) => {
  for (let i = 1; i < intervals.length; i++) {
    if (intervals[i - 1].end + 1 !== intervals[i].start) return false;
  }
  return true;
};

const boundariesSet = (intervals) => {
  const starts = new Set(intervals.map(iv => iv.start));
  const ends = new Set(intervals.map(iv => iv.end));
  return { starts, ends };
};

const overlapOfCoverages = (covA, covB) => {
  const s = Math.max(covA.start, covB.start);
  const e = Math.min(covA.end, covB.end);
  return s <= e ? { start: s, end: e } : null;
};

/**
 * Given a list L_k and its neighbors' coverages (optional),
 * compute the segments within L_k's coverage that do NOT overlap either neighbor.
 * Returns an array of [start, end] disjoint inclusive ranges.
 */
const exclusiveSegments = (listK, covPrev, covNext) => {
  const covK = coverage(listK);
  const overlaps = [];
  if (covPrev) {
    const o = overlapOfCoverages(covK, covPrev);
    if (o) overlaps.push(o);
  }
  if (covNext) {
    const o = overlapOfCoverages(covK, covNext);
    if (o) overlaps.push(o);
  }
  overlaps.sort((a, b) => a.start - b.start);

  const segs = [];
  let cursor = covK.start;

  for (const o of overlaps) {
    if (cursor <= o.start - 1) {
      segs.push([cursor, o.start - 1]);
    }
    cursor = Math.max(cursor, o.end + 1);
  }
  if (cursor <= covK.end) {
    segs.push([cursor, covK.end]);
  }
  return segs;
};

/**
 * Collect interval boundary points of a list within given [a, b] inclusive range.
 * Returns { starts: Set<number>, ends: Set<number> }.
 */
const boundariesInRange = (intervals, a, b) => {
  const starts = new Set();
  const ends = new Set();
  for (const iv of intervals) {
    if (iv.start >= a && iv.start <= b) starts.add(iv.start);
    if (iv.end >= a && iv.end <= b) ends.add(iv.end);
  }
  return { starts, ends };
};

/**
 * Assert that all boundary points in `expected` appear as boundaries in `merged`.
 */
const expectBoundariesPreserved = (expected, merged) => {
  const mergedB = boundariesSet(merged);
  for (const s of expected.starts) {
    expect(mergedB.starts.has(s) || mergedB.ends.has(s)).toBe(true);
  }
  for (const e of expected.ends) {
    expect(mergedB.starts.has(e) || mergedB.ends.has(e)).toBe(true);
  }
};

describe('mergeChunkIntervals invariants', () => {
  it('single list: returns identical segmentation, continuous and proper coverage', () => {
    const L0 = [
      { start: 1, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 12 },
    ];
    const merged = mergeChunkIntervals([L0]);

    expect(merged).toEqual(L0);
    expect(isContinuous(merged)).toBe(true);
    expect(merged[0].start).toBe(L0[0].start);
    expect(merged[merged.length - 1].end).toBe(L0[L0.length - 1].end);
  });

  it('two lists with mid overlap: continuity, coverage, and non-overlapping boundaries preserved', () => {
    const A = [
      { start: 1, end: 5 },
      { start: 6, end: 12 },
      { start: 13, end: 20 },
      { start: 21, end: 28 },
      { start: 29, end: 30 },
      { start: 31, end: 35 },
      { start: 36, end: 40 },
    ]; // coverage [1..40]

    const B = [
      { start: 30, end: 42 },
      { start: 43, end: 46 },
      { start: 47, end: 54 },
      { start: 55, end: 60 },
      { start: 61, end: 70 },
    ]; // coverage [30..70]

    const merged = mergeChunkIntervals([A, B], { tolerance: 1 });

    // continuity
    expect(isContinuous(merged)).toBe(true);

    // coverage
    expect(merged[0].start).toBe(A[0].start);
    expect(merged[merged.length - 1].end).toBe(B[B.length - 1].end);

    // Non-overlapping boundaries preserved:
    const covA = coverage(A);
    const covB = coverage(B);
    const oAB = overlapOfCoverages(covA, covB); // [30..40]

    // Exclusive to A: [1..29]
    const A_exclusive = [[covA.start, oAB.start - 1]];
    let A_expected = { starts: new Set(), ends: new Set() };
    for (const [s, e] of A_exclusive) {
      const b = boundariesInRange(A, s, e);
      for (const v of b.starts) A_expected.starts.add(v);
      for (const v of b.ends) A_expected.ends.add(v);
    }

    // Exclusive to B: [41..70]
    const B_exclusive = [[oAB.end + 1, covB.end]];
    let B_expected = { starts: new Set(), ends: new Set() };
    for (const [s, e] of B_exclusive) {
      const b = boundariesInRange(B, s, e);
      for (const v of b.starts) B_expected.starts.add(v);
      for (const v of b.ends) B_expected.ends.add(v);
    }

    expectBoundariesPreserved(A_expected, merged);
    expectBoundariesPreserved(B_expected, merged);
  });

  it('three lists with two overlaps: continuity, coverage, and preservation in exclusive zones', () => {
    const I0 = [
      { start: 1, end: 4 },
      { start: 5, end: 9 },
      { start: 10, end: 13 },
      { start: 14, end: 16 },
      { start: 17, end: 20 },
    ]; // [1..20]

    const I1 = [
      { start: 15, end: 18 },
      { start: 19, end: 22 },
      { start: 23, end: 27 },
      { start: 28, end: 31 },
      { start: 32, end: 35 },
    ]; // [15..35]

    const I2 = [
      { start: 30, end: 33 },
      { start: 34, end: 37 },
      { start: 38, end: 42 },
      { start: 43, end: 47 },
      { start: 48, end: 50 },
    ]; // [30..50]

    const lists = [I0, I1, I2];
    const merged = mergeChunkIntervals(lists, { tolerance: 1 });

    // continuity
    expect(isContinuous(merged)).toBe(true);

    // coverage
    expect(merged[0].start).toBe(I0[0].start);
    expect(merged[merged.length - 1].end).toBe(I2[I2.length - 1].end);

    // Non-overlapping boundary preservation
    const covs = lists.map(coverage);
    // For each list, compute exclusive segments and assert those boundaries persist
    for (let k = 0; k < lists.length; k++) {
      const covPrev = k > 0 ? covs[k - 1] : null;
      const covNext = k < lists.length - 1 ? covs[k + 1] : null;
      const exclSegs = exclusiveSegments(lists[k], covPrev, covNext);
      const expected = { starts: new Set(), ends: new Set() };
      for (const [s, e] of exclSegs) {
        const b = boundariesInRange(lists[k], s, e);
        for (const v of b.starts) expected.starts.add(v);
        for (const v of b.ends) expected.ends.add(v);
      }
      expectBoundariesPreserved(expected, merged);
    }
  });

  it('tiny overlap (single paragraph): continuity, coverage, and exclusive boundary preservation', () => {
    const A = [
      { start: 1, end: 10 },
      { start: 11, end: 20 },
    ]; // [1..20]

    const B = [
      { start: 20, end: 30 },
      { start: 31, end: 40 },
    ]; // [20..40]

    const merged = mergeChunkIntervals([A, B], { tolerance: 1 });

    // continuity
    expect(isContinuous(merged)).toBe(true);

    // coverage
    expect(merged[0].start).toBe(1);
    expect(merged[merged.length - 1].end).toBe(40);

    const covA = coverage(A);
    const covB = coverage(B);
    const o = overlapOfCoverages(covA, covB); // [20..20]

    // Exclusive boundaries for A: [1..19]
    const A_expected = boundariesInRange(A, covA.start, o.start - 1);
    // Exclusive boundaries for B: [21..40]
    const B_expected = boundariesInRange(B, o.end + 1, covB.end);

    expectBoundariesPreserved(A_expected, merged);
    expectBoundariesPreserved(B_expected, merged);
  });
});