import { describe, it, expect, beforeEach } from "vitest";

import { resolveChunkSizePreset, DEFAULT_TARGET_SIZE } from "../utils.js";
import jaEnBuilder, { chunkSizeOptions as jaEnOptions } from "../ja_en/text-segmentation.js";
import genericBuilder, { chunkSizeOptions as genericOptions } from "../generic/text-segmentation.js";
import { getChunkSizeOptions } from "../index.js";

const sampleParagraphs = [{ text: "sample", index: 0 }];

function buildJaEn(config) {
  return jaEnBuilder.build(sampleParagraphs, 0, config).system;
}

function buildGeneric(config) {
  return genericBuilder.build(sampleParagraphs, 0, config).system;
}

const genericConfig = (textSegmentation) => ({
  sourceLangName: "English",
  targetLangName: "French",
  textSegmentation,
});

beforeEach(() => {
  // index.js caches resolved modules; not affected by these tests
});

describe("resolveChunkSizePreset", () => {
  it("returns the requested key when it exists", () => {
    const { key } = resolveChunkSizePreset({ small: {}, medium: {} }, "small");
    expect(key).toBe("small");
  });

  it("falls back to the default when the requested key is unknown", () => {
    const { key } = resolveChunkSizePreset({ small: {}, medium: {} }, "xl");
    expect(key).toBe(DEFAULT_TARGET_SIZE);
  });

  it("falls back to the first key when the default is missing", () => {
    const { key } = resolveChunkSizePreset({ large: {}, huge: {} }, "small");
    expect(key).toBe("large");
  });

  it("handles undefined / null requested keys", () => {
    const { key } = resolveChunkSizePreset({ medium: { a: 1 } }, undefined);
    expect(key).toBe("medium");
  });

  it("throws when no presets exist", () => {
    expect(() => resolveChunkSizePreset({}, "medium")).toThrow();
    expect(() => resolveChunkSizePreset(null, "medium")).toThrow();
  });
});

describe("ja_en text-segmentation prompt sizes", () => {
  it("medium matches the original hard-coded prompt values", () => {
    const system = buildJaEn({ textSegmentation: { targetSize: "medium" } });
    expect(system).toContain("Target: 100–200 characters.");
    expect(system).toContain("Allowed: 50–400 characters.");
    expect(system).toContain("exceeds 300 characters");
    expect(system).toContain("(<40 characters)");
    expect(system).toContain("≤200 characters");
    expect(system).toContain("exceed 200 characters, you must split within the block");
  });

  it("defaults to medium when config lacks textSegmentation", () => {
    const withMedium = buildJaEn({ textSegmentation: { targetSize: "medium" } });
    const withNothing = buildJaEn({});
    const withUndefined = buildJaEn(undefined);
    expect(withNothing).toBe(withMedium);
    expect(withUndefined).toBe(withMedium);
  });

  it("defaults to medium for unknown size keys", () => {
    const withBogus = buildJaEn({ textSegmentation: { targetSize: "xl" } });
    const withMedium = buildJaEn({ textSegmentation: { targetSize: "medium" } });
    expect(withBogus).toBe(withMedium);
  });

  it("produces different prompts for small and large", () => {
    const small = buildJaEn({ textSegmentation: { targetSize: "small" } });
    const medium = buildJaEn({ textSegmentation: { targetSize: "medium" } });
    expect(small).toContain(`Target: ${jaEnOptions.small.targetRange}`);
    expect(small).not.toBe(medium);
  });
});

describe("generic text-segmentation prompt sizes", () => {
  it("medium matches the original hard-coded prompt values", () => {
    const system = buildGeneric(genericConfig({ targetSize: "medium" }));
    expect(system).toContain("**150 tokens**");
    expect(system).toContain("~50 characters");
    expect(system).toContain("(>10 lines)");
  });

  it("defaults to medium when config lacks textSegmentation", () => {
    const withMedium = buildGeneric(genericConfig({ targetSize: "medium" }));
    const withNothing = buildGeneric({ sourceLangName: "English", targetLangName: "French" });
    expect(withNothing).toBe(withMedium);
  });

  it("defaults to medium for unknown size keys", () => {
    const withBogus = buildGeneric(genericConfig({ targetSize: "xl" }));
    const withMedium = buildGeneric(genericConfig({ targetSize: "medium" }));
    expect(withBogus).toBe(withMedium);
  });

  it("interpolates the selected preset values", () => {
    const large = buildGeneric(genericConfig({ targetSize: "large" }));
    expect(large).toContain(`**${genericOptions.large.targetTokens} tokens**`);
    expect(large).toContain(`(>${genericOptions.large.maxDialogueLines} lines)`);
  });
});

describe("getChunkSizeOptions", () => {
  it("returns the specific pair's presets", async () => {
    const options = await getChunkSizeOptions("ja_en");
    expect(options).toBe(jaEnOptions);
  });

  it("falls back to the generic presets for unknown pairs", async () => {
    const options = await getChunkSizeOptions("fr_de");
    expect(options).toBe(genericOptions);
  });
});
