// Minimal mock for the Chrome extension APIs
const chromeMock = new Proxy({}, {
  get(target, prop) {
    // If this is a property that is explicitly mocked, return it
    if (prop in target) return target[prop]
    // Otherwise, log a warning
    console.warn(`[Vitest mock] Attempted to access unmocked chrome.${String(prop)} in a unit test.`);
  },
})

chromeMock.runtime = {
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  sendMessage: vi.fn(() => {
    console.warn('[Vitest mock] chrome.runtime.sendMessage should not be called in unit tests.');
  }),
}

chromeMock.storage = {
  local: {
    get: vi.fn((key, cb) => cb?.({ [key]: null })),
    set: vi.fn((data, cb) => cb?.()),
  },
}

globalThis.chrome = chromeMock