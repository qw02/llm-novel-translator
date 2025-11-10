/**
 * Merge overlapping LLM-proposed paragraph intervals into a single clean segmentation.
 * Accepts either:
 *  - Single list: [[s,e], [s,e], ...]
 *  - Multiple lists: [ [[s,e], ...], [[s,e], ...], ... ]
 *
 * Returns a single list of [start, end] pairs.
 */

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const inRangeIncl = (x, a, b) => x >= a && x <= b;

const isPair = (v) => Array.isArray(v) && v.length === 2 &&
  Number.isInteger(v[0]) && Number.isInteger(v[1]);

const toObjList = (pairs) => pairs.map(([start, end]) => ({ start, end }));
const toPairList = (objs) => objs.map(({ start, end }) => [start, end]);

const normalizeInput = (input) => {
  // If input is [[s,e], [s,e], ...], wrap as a single list
  if (Array.isArray(input) && input.length > 0 && isPair(input[0])) {
    return [toObjList(input)];
  }
  // If input is [ [[s,e],...], [[s,e],...], ... ]
  if (Array.isArray(input) && input.length > 0 && Array.isArray(input[0]) && input[0].length > 0 && isPair(input[0][0])) {
    return input.map(toObjList);
  }
  // Empty or unexpected -> treat as empty
  return [];
};

const intervalEnds = (intervals) => intervals.map(iv => iv.end);

const coverage = (intervals) => {
  if (!intervals || intervals.length === 0) return null;
  return { start: intervals[0].start, end: intervals[intervals.length - 1].end };
};

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
    // No overlap: choose seam at left end to stay monotone.
    return Math.min(covL.end, covR.end);
  }

  const mid = Math.floor((overlapStart + overlapEnd) / 2);
  const endsL = intervalEnds(leftIntervals).filter(e => inRangeIncl(e, overlapStart, overlapEnd));
  const endsR = intervalEnds(rightIntervals).filter(e => inRangeIncl(e, overlapStart, overlapEnd));

  const consensus = [];
  if (endsL.length && endsR.length) {
    let jStart = 0;
    for (let i = 0; i < endsL.length; i++) {
      const a = endsL[i];
      while (jStart < endsR.length && endsR[jStart] < a - tolerance) jStart++;
      for (let j = jStart; j < endsR.length && endsR[j] <= a + tolerance; j++) {
        const b = endsR[j];
        const cand = Math.abs(a - mid) <= Math.abs(b - mid) ? a : b;
        consensus.push(cand);
      }
    }
  }

  const preferMidClosest = (candidates) => {
    if (!candidates.length) return null;
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

  if (consensus.length) return preferMidClosest(consensus);

  const union = [...new Set([...endsL, ...endsR])].sort((a, b) => a - b);
  if (union.length) return preferMidClosest(union);

  return mid;
};

/**
 * Public API
 * @param {Array} input - either [[s,e], ...] or [ [[s,e],...], [[s,e],...], ... ]
 * @param {Object} options - { tolerance?: number }
 * @returns {Array<[number, number]>} merged single list as [start,end] pairs
 */
export function mergeChunkIntervals(input, options = {}) {
  const lists = normalizeInput(input);
  if (lists.length === 0) return [];
  if (lists.length === 1) return toPairList(lists[0].map(iv => ({ ...iv })));

  const N = lists.length;
  const cuts = new Array(N - 1);

  for (let i = 0; i < N - 1; i++) {
    cuts[i] = chooseCut(lists[i], lists[i + 1], options);
  }

  const cov0 = coverage(lists[0]);
  const covLast = coverage(lists[N - 1]);

  const resultObjs = [];

  const appendSlice = (intervals, a, b) => {
    const slice = sliceIntervals(intervals, a, b);
    for (const iv of slice) resultObjs.push(iv);
  };

  appendSlice(lists[0], cov0.start, cuts[0]);

  for (let i = 1; i < N - 1; i++) {
    const left = cuts[i - 1] + 1;
    const right = cuts[i];
    if (left <= right) appendSlice(lists[i], left, right);
  }

  appendSlice(lists[N - 1], cuts[N - 2] + 1, covLast.end);

  return toPairList(resultObjs);
}
