/**
 * Merge overlapping LLM-proposed paragraph intervals into a single clean split.
 * Assumptions per prompt:
 *  - Each list is sorted, contiguous, and non-overlapping; end of interval i is start of i+1 minus 1.
 *  - Adjacent lists overlap; non-adjacent do not.
 *
 * Interval type: { start: number, end: number } inclusive.
 */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const inRangeIncl = (x, a, b) => x >= a && x <= b;

/**
 * Collects the end positions of intervals in a list.
 * These are the candidate cut points (the "last included paragraph" for the left side).
 */
const intervalEnds = (intervals) => intervals.map(iv => iv.end);

/**
 * Compute the overall coverage [start, end] (inclusive) for a list of intervals.
 */
const coverage = (intervals) => {
  if (!intervals || intervals.length === 0) return null;
  return { start: intervals[0].start, end: intervals[intervals.length - 1].end };
};

/**
 * Returns a shallow copy of `intervals` clipped to [clipStart, clipEnd] inclusive.
 * Splits at edges when needed, preserves internal boundaries.
 */
const sliceIntervals = (intervals, clipStart, clipEnd) => {
  if (clipStart > clipEnd) return [];
  const out = [];
  for (const iv of intervals) {
    if (iv.end < clipStart) continue;
    if (iv.start > clipEnd) break;
    const s = Math.max(iv.start, clipStart);
    const e = Math.min(iv.end, clipEnd);
    if (s <= e) out.push({ start: s, end: e });
  }
  return out;
};

/**
 * Choose a single cut point for one overlap window between two interval lists.
 * Heuristics:
 *  - Prefer consensus boundaries (within tolerance) from both sides.
 *  - Otherwise pick the boundary closest to the window midpoint.
 *  - If no boundary in the window, cut at midpoint.
 *
 * Returns an integer cut C such that left keeps up to C and right starts at C+1.
 */
const chooseCut = (leftIntervals, rightIntervals, opts = {}) => {
  const { tolerance = 1 } = opts;
  const covL = coverage(leftIntervals);
  const covR = coverage(rightIntervals);
  if (!covL || !covR) {
    throw new Error("Empty interval list provided to chooseCut");
  }

  const overlapStart = Math.max(covL.start, covR.start);
  const overlapEnd = Math.min(covL.end, covR.end);
  if (overlapStart > overlapEnd) {
    // No overlap: return a seam at the boundary between them (prefer left end).
    // This shouldn't happen per assumptions, but we make a safe choice anyway.
    return Math.min(covL.end, covR.end);
  }

  const mid = Math.floor((overlapStart + overlapEnd) / 2);

  const endsL = intervalEnds(leftIntervals).filter(e => inRangeIncl(e, overlapStart, overlapEnd));
  const endsR = intervalEnds(rightIntervals).filter(e => inRangeIncl(e, overlapStart, overlapEnd));

  // Helper: find consensus candidates within ±tolerance.
  const consensus = [];
  if (endsL.length && endsR.length) {
    let jStart = 0;
    // Ends arrays are sorted due to input assumptions.
    for (let i = 0; i < endsL.length; i++) {
      const a = endsL[i];
      // Advance jStart to first plausible match (b >= a - tolerance)
      while (jStart < endsR.length && endsR[jStart] < a - tolerance) jStart++;
      // Check all b within tolerance window
      for (let j = jStart; j < endsR.length && endsR[j] <= a + tolerance; j++) {
        const b = endsR[j];
        // Merge the pair into a single candidate: pick the one closer to midpoint.
        const cand = Math.abs(a - mid) <= Math.abs(b - mid) ? a : b;
        consensus.push(cand);
      }
    }
  }

  const preferMidClosest = (candidates) => {
    if (!candidates.length) return null;
    // Penalize overlap edges very slightly to avoid edge cuts when avoidable.
    let best = candidates[0];
    let bestScore = -Math.abs(best - mid) - (best === overlapStart || best === overlapEnd ? 0.25 : 0);
    for (let k = 1; k < candidates.length; k++) {
      const v = candidates[k];
      const score = -Math.abs(v - mid) - (v === overlapStart || v === overlapEnd ? 0.25 : 0);
      if (score > bestScore) {
        best = v; bestScore = score;
      }
    }
    return best;
  };

  // 1) Try consensus first.
  if (consensus.length) {
    return preferMidClosest(consensus);
  }

  // 2) Otherwise, pick the nearest boundary to the midpoint from either side.
  const union = [...new Set([...endsL, ...endsR])].sort((a, b) => a - b);
  if (union.length) {
    return preferMidClosest(union);
  }

  // 3) Fallback: no boundary inside overlap; cut at midpoint.
  return mid;
};

/**
 * Merge a sequence of interval lists into a single segmentation across the entire span.
 *
 * @param {Array<Array<{start:number,end:number}>>} lists - e.g., [I0, I1, ..., IN-1]
 * @param {Object} options
 *   - tolerance (number): soft consensus window in paragraphs, default 1.
 * @returns {Array<{start:number,end:number}>}
 */
export const mergeChunkIntervals = (lists, options = {}) => {
  if (!Array.isArray(lists) || lists.length === 0) return [];
  if (lists.length === 1) return lists[0].map(iv => ({ ...iv }));

  const N = lists.length;
  const cuts = new Array(N - 1);

  // Compute all seams independently; adjacent overlaps never conflict with non-adjacent windows.
  for (let i = 0; i < N - 1; i++) {
    cuts[i] = chooseCut(lists[i], lists[i + 1], options);
  }

  const cov0 = coverage(lists[0]);
  const covLast = coverage(lists[N - 1]);

  const result = [];

  // Helper to append a clipped slice, preserving segmentation inside each list.
  const appendSlice = (intervals, a, b) => {
    const slice = sliceIntervals(intervals, a, b);
    for (const iv of slice) result.push(iv);
  };

  // First list: from its start to cut0
  appendSlice(lists[0], cov0.start, cuts[0]);

  // Middle lists: from previous cut+1 to next cut
  for (let i = 1; i < N - 1; i++) {
    const left = cuts[i - 1] + 1;
    const right = cuts[i];
    if (left <= right) appendSlice(lists[i], left, right);
  }

  // Last list: from last cut+1 to its end
  appendSlice(lists[N - 1], cuts[N - 2] + 1, covLast.end);

  // The result is contiguous by construction; we intentionally do NOT coalesce across seams,
  // because seams denote semantic breaks chosen by the algorithm.
  return result;
};
