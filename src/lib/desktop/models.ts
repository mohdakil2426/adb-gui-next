export namespace backend {
  export class Device {
    serial: string;
    status: string;

    static createFrom(source: any = {}) {
      return new Device(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.serial = source['serial'];
      this.status = source['status'];
    }
  }

  export class DeviceInfo {
    model: string;
    androidVersion: string;
    buildNumber: string;
    batteryLevel: string;
    serial: string;
    ipAddress: string;
    rootStatus: string;
    codename: string;
    ramTotal: string;
    storageInfo: string;
    brand: string;
    deviceName: string;

    static createFrom(source: any = {}) {
      return new DeviceInfo(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.model = source['model'];
      this.androidVersion = source['androidVersion'];
      this.buildNumber = source['buildNumber'];
      this.batteryLevel = source['batteryLevel'];
      this.serial = source['serial'];
      this.ipAddress = source['ipAddress'];
      this.rootStatus = source['rootStatus'];
      this.codename = source['codename'];
      this.ramTotal = source['ramTotal'];
      this.storageInfo = source['storageInfo'];
      this.brand = source['brand'];
      this.deviceName = source['deviceName'];
    }
  }

  export class ExtractPayloadResult {
    success: boolean;
    outputDir: string;
    extractedFiles: string[];
    error?: string;

    static createFrom(source: any = {}) {
      return new ExtractPayloadResult(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.success = source['success'];
      this.outputDir = source['outputDir'];
      this.extractedFiles = source['extractedFiles'];
      this.error = source['error'];
    }
  }

  export class FileEntry {
    name: string;
    type: string;
    size: string;
    permissions: string;
    date: string;
    time: string;

    static createFrom(source: any = {}) {
      return new FileEntry(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.name = source['name'];
      this.type = source['type'];
      this.size = source['size'];
      this.permissions = source['permissions'];
      this.date = source['date'];
      this.time = source['time'];
    }
  }

  export class InstalledPackage {
    name: string;

    static createFrom(source: any = {}) {
      return new InstalledPackage(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.name = source['name'];
    }
  }

  export class PartitionDetail {
    name: string;
    size: number;

    static createFrom(source: any = {}) {
      return new PartitionDetail(source);
    }

    constructor(source: any = {}) {
      if (typeof source === 'string') source = JSON.parse(source);
      this.name = source['name'];
      this.size = source['size'];
    }
  }
}
