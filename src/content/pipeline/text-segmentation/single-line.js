export function segmentSingleLine(texts) {
  return texts.map((_, i) => [i, i]);
}