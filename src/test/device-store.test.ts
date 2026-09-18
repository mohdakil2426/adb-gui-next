import { beforeEach, describe, expect, it } from "vitest";

import { useDeviceStore } from "@/shared/stores/device-store";

describe(useDeviceStore, () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  describe("setDevices", () => {
    it("should set devices array", () => {
      const mockDevices = [{ serial: "device-1", status: "device" }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.devices).toHaveLength(1);
      expect(state.devices[0]?.serial).toBe("device-1");
    });

    it("should auto-select first device when no device is selected", () => {
      const mockDevices = [
        { serial: "device-1", status: "device" },
        { serial: "device-2", status: "device" },
      ];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe("device-1");
    });

    it("should preserve selection when selected device still connected", () => {
      useDeviceStore.setState({ selectedSerial: "device-1" });
      const mockDevices = [{ serial: "device-1", status: "device" }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe("device-1");
    });

    it("should auto-select new device when selected device disconnected", () => {
      useDeviceStore.setState({ selectedSerial: "device-1" });
      const mockDevices = [{ serial: "device-2", status: "device" }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe("device-2");
    });

    it("should set deviceInfo to null when selected device changes", () => {
      useDeviceStore.setState({
        deviceInfo: {
          androidVersion: "14",
          batteryLevel: "100",
          brand: "Google",
          buildNumber: "UQ1A",
          codename: "pixel",
          deviceName: "Pixel 8",
          ipAddress: "",
          model: "Pixel 8",
          ramTotal: "8GB",
          rootStatus: "Unknown",
          serial: "device-1",
          storageInfo: "128GB",
        },
        selectedSerial: "device-1",
      });
      const mockDevices = [{ serial: "device-2", status: "device" }];
      useDeviceStore.getState().setDevices(mockDevices);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });

    it("should update lastUpdated timestamp when devices change", () => {
      const before = Date.now();
      useDeviceStore.getState().setDevices([{ serial: "device-1", status: "device" }]);
      const after = Date.now();

      const state = useDeviceStore.getState();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });

    it("should skip set when serials and statuses are unchanged", () => {
      const mockDevices = [{ serial: "device-1", status: "device" }];
      useDeviceStore.getState().setDevices(mockDevices);
      const firstUpdated = useDeviceStore.getState().lastUpdated;
      const firstDevices = useDeviceStore.getState().devices;

      useDeviceStore.getState().setDevices([{ serial: "device-1", status: "device" }]);

      const state = useDeviceStore.getState();
      expect(state.lastUpdated).toBe(firstUpdated);
      expect(state.devices).toBe(firstDevices);
    });
  });

  describe("setSelectedSerial", () => {
    it("should set selected serial", () => {
      useDeviceStore.getState().setSelectedSerial("device-1");

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBe("device-1");
    });

    it("should clear deviceInfo when changing selection", () => {
      useDeviceStore.setState({
        deviceInfo: {
          androidVersion: "14",
          batteryLevel: "100",
          brand: "Google",
          buildNumber: "UQ1A",
          codename: "pixel",
          deviceName: "Pixel 8",
          ipAddress: "",
          model: "Pixel 8",
          ramTotal: "8GB",
          rootStatus: "Unknown",
          serial: "device-1",
          storageInfo: "128GB",
        },
      });
      useDeviceStore.getState().setSelectedSerial("device-2");

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });

    it("should accept null to clear selection", () => {
      useDeviceStore.setState({ selectedSerial: "device-1" });
      useDeviceStore.getState().setSelectedSerial(null);

      const state = useDeviceStore.getState();
      expect(state.selectedSerial).toBeNull();
    });
  });

  describe("setDeviceInfo", () => {
    it("should set device info", () => {
      const deviceInfo = {
        androidVersion: "14",
        batteryLevel: "100",
        brand: "Google",
        buildNumber: "UQ1A",
        codename: "pixel",
        deviceName: "Pixel 8",
        ipAddress: "",
        model: "Pixel 8",
        ramTotal: "8GB",
        rootStatus: "Unknown",
        serial: "device-1",
        storageInfo: "128GB",
      };
      useDeviceStore.getState().setDeviceInfo(deviceInfo);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toStrictEqual(deviceInfo);
    });

    it("should accept null to clear device info", () => {
      useDeviceStore.setState({
        deviceInfo: {
          androidVersion: "14",
          batteryLevel: "100",
          brand: "Google",
          buildNumber: "UQ1A",
          codename: "pixel",
          deviceName: "Pixel 8",
          ipAddress: "",
          model: "Pixel 8",
          ramTotal: "8GB",
          rootStatus: "Unknown",
          serial: "device-1",
          storageInfo: "128GB",
        },
      });
      useDeviceStore.getState().setDeviceInfo(null);

      const state = useDeviceStore.getState();
      expect(state.deviceInfo).toBeNull();
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      useDeviceStore.setState({
        deviceInfo: {
          androidVersion: "14",
          batteryLevel: "100",
          brand: "Google",
          buildNumber: "UQ1A",
          codename: "pixel",
          deviceName: "Pixel 8",
          ipAddress: "",
          model: "Pixel 8",
          ramTotal: "8GB",
          rootStatus: "Unknown",
          serial: "device-1",
          storageInfo: "128GB",
        },
        devices: [{ serial: "device-1", status: "device" }],
        lastUpdated: Date.now(),
        selectedSerial: "device-1",
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
