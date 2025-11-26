import { DomainAdapter } from './DomainAdapter.js';

// For dev testing only
import { LocalFileTestAdapter } from './sites/local-file-test.js';

// Fall back to use if nothing else matches
import { FallbackGenericAdapter } from './sites/fallback-generic.js';

import { KakuyomuAdapter } from "./sites/kakuyomu.js";
import { SyosetuAdapter } from "./sites/syosetu.js";
import { ShukuAdapter } from "./sites/shuku.js";

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
  KakuyomuAdapter,
  SyosetuAdapter,
  ShukuAdapter
];

/**
 * Single fallback adapter class, used when nothing else matches.
 */
const FALLBACK_ADAPTER_CLASS = FallbackGenericAdapter;

let cachedAdapter = null;

/**
 * Resolve (and cache) the appropriate adapter instance for the current page.
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

  // No specific adapter matched: use the generic fallback.
  cachedAdapter = new FALLBACK_ADAPTER_CLASS();
  return cachedAdapter;
}

/**
 * Returns true if there is a site-specific adapter for the given URL,
 * i.e. an adapter other than the fallback generic one.
 *
 * If url is omitted, window.location.href is used.
 *
 * @param {string} [url]
 * @returns {boolean}
 */
export function isSiteSupported(url = window.location.href) {
  for (const AdapterClass of ADAPTER_CLASSES) {
    const patterns = AdapterClass.matchPatterns || [];
    const matched = patterns.some((pattern) => urlMatchesPattern(url, pattern));
    if (matched) {
      return true;
    }
  }
  return false;
}
