import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNickname, setNickname } from '@/shared/stores/nicknameStore';

describe('nicknameStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('setNickname', () => {
    it('should set nickname for a device serial', () => {
      setNickname('device-1', 'My Phone');

      expect(localStorage.getItem('adb-kit-nicknames')).toBe(
        JSON.stringify({ 'device-1': 'My Phone' }),
      );
    });

    it('should update existing nickname', () => {
      setNickname('device-1', 'My Phone');
      setNickname('device-1', 'Pixel 8');

      const stored = JSON.parse(localStorage.getItem('adb-kit-nicknames') ?? '{}') as Record<
        string,
        string
      >;
      expect(stored['device-1']).toBe('Pixel 8');
    });

    it('should remove nickname when empty string provided', () => {
      setNickname('device-1', 'My Phone');
      setNickname('device-1', '');

      const stored = JSON.parse(localStorage.getItem('adb-kit-nicknames') ?? '{}') as Record<
        string,
        string
      >;
      expect(stored['device-1']).toBeUndefined();
    });

    it('should handle multiple devices', () => {
      setNickname('device-1', 'Phone One');
      setNickname('device-2', 'Phone Two');

      const stored = JSON.parse(localStorage.getItem('adb-kit-nicknames') ?? '{}') as Record<
        string,
        string
      >;
      expect(stored['device-1']).toBe('Phone One');
      expect(stored['device-2']).toBe('Phone Two');
    });
  });

  describe('getNickname', () => {
    it('should return nickname for a device', () => {
      setNickname('device-1', 'My Phone');

      expect(getNickname('device-1')).toBe('My Phone');
    });

    it('should return null when no nickname set', () => {
      expect(getNickname('device-unknown')).toBeNull();
    });

    it('should return empty string for empty nickname', () => {
      localStorage.setItem('adb-kit-nicknames', JSON.stringify({ 'device-1': '' }));

      expect(getNickname('device-1')).toBe('');
    });
  });
});
