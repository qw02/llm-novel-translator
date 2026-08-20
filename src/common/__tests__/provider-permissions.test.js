import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PROVIDER_HOST_PERMISSIONS,
  getRequiredHostPermissions,
  hasProviderHostPermissions,
  requestProviderHostPermissions,
  assertProviderHostPermissions,
} from '../provider-permissions.js';

describe('provider-permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRequiredHostPermissions', () => {
    it('should return origins for providers that need them', () => {
      expect(getRequiredHostPermissions('local')).toEqual(['http://127.0.0.1/*']);
    });

    it('should return empty array for providers without optional hosts', () => {
      expect(getRequiredHostPermissions('openai')).toEqual([]);
      expect(getRequiredHostPermissions('unknown-provider')).toEqual([]);
    });
  });

  describe('hasProviderHostPermissions', () => {
    it('should return true without calling chrome for providers with no requirements', async () => {
      await expect(hasProviderHostPermissions('openai')).resolves.toBe(true);
      expect(chrome.permissions.contains).not.toHaveBeenCalled();
    });

    it('should query chrome.permissions with the provider origins', async () => {
      chrome.permissions.contains.mockResolvedValue(true);

      await expect(hasProviderHostPermissions('local')).resolves.toBe(true);
      expect(chrome.permissions.contains).toHaveBeenCalledWith({
        origins: PROVIDER_HOST_PERMISSIONS.local,
      });
    });

    it('should return false when not granted', async () => {
      chrome.permissions.contains.mockResolvedValue(false);

      await expect(hasProviderHostPermissions('local')).resolves.toBe(false);
    });
  });

  describe('requestProviderHostPermissions', () => {
    it('should return true without calling chrome for providers with no requirements', async () => {
      await expect(requestProviderHostPermissions('openai')).resolves.toBe(true);
      expect(chrome.permissions.request).not.toHaveBeenCalled();
    });

    it('should request the provider origins and return the result', async () => {
      chrome.permissions.request.mockResolvedValue(true);

      await expect(requestProviderHostPermissions('local')).resolves.toBe(true);
      expect(chrome.permissions.request).toHaveBeenCalledWith({
        origins: PROVIDER_HOST_PERMISSIONS.local,
      });
    });

    it('should return false when the user denies', async () => {
      chrome.permissions.request.mockResolvedValue(false);

      await expect(requestProviderHostPermissions('local')).resolves.toBe(false);
    });
  });

  describe('assertProviderHostPermissions', () => {
    it('should not throw when granted', async () => {
      chrome.permissions.contains.mockResolvedValue(true);

      await expect(assertProviderHostPermissions('local')).resolves.toBeUndefined();
    });

    it('should not throw for providers with no requirements', async () => {
      await expect(assertProviderHostPermissions('openai')).resolves.toBeUndefined();
    });

    it('should throw when permissions are missing', async () => {
      chrome.permissions.contains.mockResolvedValue(false);

      await expect(assertProviderHostPermissions('local')).rejects.toThrow('Missing host permission');
    });
  });
});
