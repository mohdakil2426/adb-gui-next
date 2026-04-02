export namespace backend {
  export interface Device {
    serial: string;
    status: string;
  }

  export interface DeviceInfo {
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
  }

  export interface ExtractPayloadResult {
    success: boolean;
    outputDir: string;
    extractedFiles: string[];
    error?: string;
  }

  export interface FileEntry {
    name: string;
    type: string;
    size: string;
    permissions: string;
    date: string;
    time: string;
    /** For symlinks: resolved target (e.g. "/proc/self/fd"). Empty for files/dirs. */
    linkTarget: string;
  }

  export interface InstalledPackage {
    name: string;
    packageType: string;
  }

  export interface PartitionDetail {
    name: string;
    size: number;
  }

  /** Information about a remote payload file obtained via HEAD request. */
  export interface RemotePayloadInfo {
    contentLength: number;
    supportsRanges: boolean;
    contentType: string | null;
    lastModified: string | null;
    server: string | null;
    etag: string | null;
  }

  /** Full metadata about a remote OTA payload — HTTP, ZIP, and OTA manifest layers. */
  export interface RemotePayloadMetadata {
    // HTTP layer
    contentLength: number;
    contentType: string | null;
    lastModified: string | null;
    server: string | null;
    etag: string | null;
    // ZIP layer
    isZip: boolean;
    zipPayloadOffset: number | null;
    zipCompressedSize: number | null;
    zipUncompressedSize: number | null;
    zipCompressionMethod: string | null;
    // OTA Manifest layer (from protobuf)
    blockSize: number;
    payloadVersion: number;
    minorVersion: number | null;
    securityPatchLevel: string | null;
    maxTimestamp: number | null;
    partialUpdate: boolean | null;
    dynamicGroups: DynamicGroupInfo[];
    partitionCount: number;
    totalSize: number;
    // OTA Package metadata (from META-INF/com/android/metadata)
    otaType: string | null;
    preDevice: string | null;
    postBuild: string | null;
    postBuildIncremental: string | null;
    postSdkLevel: string | null;
    postSecurityPatchLevel: string | null;
    postTimestamp: string | null;
    otaVersion: string | null;
    wipe: boolean | null;
    // payload_properties.txt
    fileHash: string | null;
    fileSize: number | null;
    metadataHash: string | null;
    metadataSize: number | null;
  }

  /** Dynamic partition group info from the OTA manifest. */
  export interface DynamicGroupInfo {
    name: string;
    size: number | null;
    partitions: string[];
  }
}
