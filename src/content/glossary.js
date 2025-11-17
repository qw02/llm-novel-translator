export async function getGlossary(seriesId) {
  const result = await chrome.storage.local.get({
    [seriesId]: { entries: [] },
  });

  return result[seriesId];
}

export async function saveGlossary(seriesId, glossary) {
  await chrome.storage.local.set({
    [seriesId]: glossary
  });
}
