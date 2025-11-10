/**
 * Stage 3: Split text into translation chunks
 */

import { segmentSingleLine } from "./single-line.js";
import { segmentEntirePage } from "./entire-page.js";
import { segmentWithChunking } from "./llm-chunking.js";

export async function segmentText(config, texts) {
  const method = config.textSegmentation.method;

  switch (method) {
    case 'single':
      return segmentSingleLine(texts);

    case 'entire':
      return segmentEntirePage(texts);

    case 'chunk':
      return await segmentWithChunking(config, texts);

    default:
      throw new Error(`Unknown segmentation method: ${method}`);
  }

}
