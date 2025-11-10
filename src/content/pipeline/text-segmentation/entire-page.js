export function segmentEntirePage(texts) {
  if (texts.length === 0) return [];
  return [[0, texts.length - 1]];
}