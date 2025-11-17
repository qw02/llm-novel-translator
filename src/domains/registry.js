import { DomainAdapter } from './DomainAdapter.js';
import { LocalFileTestAdapter } from './sites/local-file-test.js';
import { KakuyomuAdapter } from "./sites/kakuyomu.js";

/**
 * Simple wildcard matcher for URL patterns used by domain adapters.
 *
 * Pattern syntax:
 *  - '*' matches any sequence of characters.
 *  - Patterns are matched against the full URL string.
 *
 * Examples:
 *  - "https://*.example.com/*"
 *  - "file:///C:/path/to/test-page.html"
 *
 * @param {string} url
 * @param {string} pattern
 * @returns {boolean}
 */
export function urlMatchesPattern(url, pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp('^' + escaped + '$');
  return regex.test(url);
}

/**
 * List of all adapter classes available to the extension.
 * Order matters; the first matching adapter is used.
 *
 * @type {Array<typeof DomainAdapter>}
 */
const ADAPTER_CLASSES = [
  LocalFileTestAdapter,
  KakuyomuAdapter
];

let cachedAdapter = null;

/**
 * Resolve (and cache) the appropriate adapter instance for the current page.
 *
 * If no adapter matches, this function throws. The caller (typically the
 * content script) can catch this and show an appropriate error in the UI.
 *
 * @param {string} [url]
 * @returns {DomainAdapter}
 */
export function getActiveAdapter(url = window.location.href) {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  for (const AdapterClass of ADAPTER_CLASSES) {
    const patterns = AdapterClass.matchPatterns || [];
    const matched = patterns.some((pattern) => urlMatchesPattern(url, pattern));
    if (matched) {
      cachedAdapter = new AdapterClass();
      return cachedAdapter;
    }
  }

  throw new Error(`No DomainAdapter registered for URL: ${url}`);
}

/**
 * Clear the cached adapter instance.
 * This is mostly useful for testing.
 */
export function resetAdapterCache() {
  cachedAdapter = null;
}