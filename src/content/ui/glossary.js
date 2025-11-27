import { MSG_TYPE } from "../../common/messaging.js";

export async function getGlossary(seriesId) {
  const response = await chrome.runtime.sendMessage({
    type: MSG_TYPE.get_glossary,
    seriesId
  });

  if (response._error) {
    throw new Error(response._error);
  }

  return response;
}

export async function saveGlossary(seriesId, glossary) {
  const response = await chrome.runtime.sendMessage({
    type: MSG_TYPE.save_glossary,
    seriesId,
    glossary
  });

  if (response._error) {
    throw new Error(response._error);
  }
}
