import { beforeEach, describe, expect, it } from 'vitest';
import { useDeviceStore } from '@/shared/stores/deviceStore';

describe('useDeviceStore', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  describe('setDevices', () => {
    it('should set devices array', () => {
      const mockDevices = [{ serial: 'device-1', status: 'device' }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.devices).toHaveLength(1);
      expect(state.devices[0]?.serial).toBe('device-1');
    });

    it('should auto-select first device when no device is selected', () => {
      const mockDevices = [
        { serial: 'device-1', status: 'device' },
        { serial: 'device-2', status: 'device' },
      ];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe('device-1');
    });

    it('should preserve selection when selected device still connected', () => {
      useDeviceStore.setState({ selectedSerial: 'device-1' });
      const mockDevices = [{ serial: 'device-1', status: 'device' }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe('device-1');
    });

    it('should auto-select new device when selected device disconnected', () => {
      useDeviceStore.setState({ selectedSerial: 'device-1' });
      const mockDevices = [{ serial: 'device-2', status: 'device' }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe('device-2');
    });

    it('should set deviceInfo to null when selected device changes', () => {
      useDeviceStore.setState({
        selectedSerial: 'device-1',
        deviceInfo: {
          serial: 'device-1',
          model: 'Pixel 8',
          androidVersion: '14',
          buildNumber: 'UQ1A',
          batteryLevel: '100',
          ipAddress: '',
          rootStatus: 'Unknown',
          codename: 'pixel',
          ramTotal: '8GB',
          storageInfo: '128GB',
          brand: 'Google',
          deviceName: 'Pixel 8',
        },
      });
      const mockDevices = [{ serial: 'device-2', status: 'device' }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });

    it('should update lastUpdated timestamp', () => {
      const before = Date.now();
      useDeviceStore.getState().setDevices([]);
      const after = Date.now();

      const state = useDeviceStore.getState();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('setSelectedSerial', () => {
    it('should set selected serial', () => {
      useDeviceStore.getState().setSelectedSerial('device-1');

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe('device-1');
    });

    it('should clear deviceInfo when changing selection', () => {
      useDeviceStore.setState({
        deviceInfo: {
          serial: 'device-1',
          model: 'Pixel 8',
          androidVersion: '14',
          buildNumber: 'UQ1A',
          batteryLevel: '100',
          ipAddress: '',
          rootStatus: 'Unknown',
          codename: 'pixel',
          ramTotal: '8GB',
          storageInfo: '128GB',
          brand: 'Google',
          deviceName: 'Pixel 8',
        },
      });
      useDeviceStore.getState().setSelectedSerial('device-2');

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });

    it('should accept null to clear selection', () => {
      useDeviceStore.setState({ selectedSerial: 'device-1' });
      useDeviceStore.getState().setSelectedSerial(null);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBeNull();
    });
  });

  describe('setDeviceInfo', () => {
    it('should set device info', () => {
      const deviceInfo = {
        serial: 'device-1',
        model: 'Pixel 8',
        androidVersion: '14',
        buildNumber: 'UQ1A',
        batteryLevel: '100',
        ipAddress: '',
        rootStatus: 'Unknown',
        codename: 'pixel',
        ramTotal: '8GB',
        storageInfo: '128GB',
        brand: 'Google',
        deviceName: 'Pixel 8',
      };
      useDeviceStore.getState().setDeviceInfo(deviceInfo);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toEqual(deviceInfo);
    });

    it('should accept null to clear device info', () => {
      useDeviceStore.setState({
        deviceInfo: {
          serial: 'device-1',
          model: 'Pixel 8',
          androidVersion: '14',
          buildNumber: 'UQ1A',
          batteryLevel: '100',
          ipAddress: '',
          rootStatus: 'Unknown',
          codename: 'pixel',
          ramTotal: '8GB',
          storageInfo: '128GB',
          brand: 'Google',
          deviceName: 'Pixel 8',
        },
      });
      useDeviceStore.getState().setDeviceInfo(null);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      useDeviceStore.setState({
        devices: [{ serial: 'device-1', status: 'device' }],
        selectedSerial: 'device-1',
        deviceInfo: {
          serial: 'device-1',
          model: 'Pixel 8',
          androidVersion: '14',
          buildNumber: 'UQ1A',
          batteryLevel: '100',
          ipAddress: '',
          rootStatus: 'Unknown',
          codename: 'pixel',
          ramTotal: '8GB',
          storageInfo: '128GB',
          brand: 'Google',
          deviceName: 'Pixel 8',
        },
        lastUpdated: Date.now(),
      });
      useDeviceStore.getState().reset();

      const state = useDeviceStore.getState();
      expect(state.devices).toHaveLength(0);
      expect(state.selectedSerial).toBeNull();
      expect(state.deviceInfo).toBeNull();
      expect(state.lastUpdated).toBe(0);
    });
  });
});
