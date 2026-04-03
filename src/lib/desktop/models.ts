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

  /** Metadata about an OPS/OFP firmware file. */
  export interface OpsMetadata {
    format: string;
    projectId: string | null;
    firmwareName: string | null;
    cpu: string | null;
    flashType: string | null;
    encryption: string;
    totalPartitions: number;
    totalSize: number;
    sections: string[];
  }

  // ─── Marketplace ─────────────────────────────────────────────────────────

  /** Provider source for marketplace results. */
  export type ProviderSource = 'F-Droid' | 'IzzyOnDroid' | 'GitHub' | 'Aptoide';

  /** An app result from the marketplace search. */
  export interface MarketplaceApp {
    name: string;
    packageName: string;
    version: string;
    summary: string;
    iconUrl: string | null;
    source: string;
    downloadUrl: string | null;
    repoUrl: string | null;
    size: number | null;
    rating: number | null;
    downloadsCount: number | null;
    malwareStatus: string | null;
    categories: string[];
  }

  /** Detailed metadata for a single marketplace app. */
  export interface MarketplaceAppDetail {
    name: string;
    packageName: string;
    version: string;
    description: string;
    iconUrl: string | null;
    source: string;
    downloadUrl: string | null;
    size: number | null;
    license: string | null;
    author: string | null;
    sourcesAvailable: string[];
    screenshots: string[];
    changelog: string | null;
    versions: VersionInfo[];
    repoStars: number | null;
    repoForks: number | null;
    rating: number | null;
    downloadsCount: number | null;
  }

  /** Version entry with download URL. */
  export interface VersionInfo {
    versionName: string;
    versionCode: number;
    size: number | null;
    downloadUrl: string | null;
    publishedAt: string | null;
  }

  /** Search filters passed to the backend. */
  export interface MarketplaceSearchFilters {
    providers: ProviderSource[];
    sortBy: 'relevance' | 'name' | 'recentlyUpdated' | 'downloads';
  }
}
