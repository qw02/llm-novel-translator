/**
 * Generic per-provider host permission handling.
 *
 * Providers that need origins beyond the core `host_permissions` declare them
 * in `PROVIDER_HOST_PERMISSIONS`; the origins must also be listed under
 * `optional_host_permissions` in manifest.json. Granting always happens from
 * the options page (requires a user gesture); the background worker only
 * checks via `assertProviderHostPermissions`.
 *
 * To add a provider: add an entry to the map below and the matching origins
 * to `optional_host_permissions` in manifest.json.
 */

export const PROVIDER_HOST_PERMISSIONS = {
  local: ['http://127.0.0.1/*'],
  nanogpt: ['https://nano-gpt.com/*'],
};

/**
 * Returns the optional host permissions a provider needs ([] if none).
 *
 * @param {string} provider - Provider name (e.g., 'local')
 * @returns {Array<string>} Origin patterns
 */
export function getRequiredHostPermissions(provider) {
  return PROVIDER_HOST_PERMISSIONS[provider] || [];
}

/**
 * Checks whether the provider's required host permissions are granted
 * (either as core host_permissions or granted optional ones).
 *
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} True if granted (or none required)
 */
export async function hasProviderHostPermissions(provider) {
  const origins = getRequiredHostPermissions(provider);
  if (origins.length === 0) return true;

  return await chrome.permissions.contains({ origins });
}

/**
 * Requests the provider's required host permissions from the user.
 * Must be called from a user gesture on an extension page (e.g., options).
 *
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} True if granted
 */
export async function requestProviderHostPermissions(provider) {
  const origins = getRequiredHostPermissions(provider);
  if (origins.length === 0) return true;

  return await chrome.permissions.request({ origins });
}

/**
 * Throws if the provider's required host permissions are not granted.
 * Guard for the background worker — by the time a request is dispatched the
 * options page should already have enforced the grant, so this only catches
 * manually manipulated storage.
 *
 * @param {string} provider - Provider name
 * @throws {Error} If permissions are missing
 */
export async function assertProviderHostPermissions(provider) {
  if (!(await hasProviderHostPermissions(provider))) {
    throw new Error(
      `Missing host permission for provider "${provider}". Grant it in the options page (API Keys tab).`
    );
  }
}
