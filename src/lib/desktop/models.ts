export namespace backend {
  export type AvdRootState = 'stock' | 'rooted' | 'modified' | 'unknown';
  export type EmulatorBootMode = 'cold' | 'normal' | 'unknown';

  export interface AvdSummary {
    name: string;
    iniPath: string;
    avdPath: string;
    target: string | null;
    apiLevel: number | null;
    abi: string | null;
    deviceName: string | null;
    ramdiskPath: string | null;
    hasBackups: boolean;
    rootState: AvdRootState;
    bootMode: EmulatorBootMode;
    isRunning: boolean;
    serial: string | null;
    warnings: string[];
  }

  export interface EmulatorLaunchOptions {
    wipeData: boolean;
    writableSystem: boolean;
    coldBoot: boolean;
    noSnapshotLoad: boolean;
    noSnapshotSave: boolean;
    noBootAnim: boolean;
  }

  export interface BackupEntry {
    originalPath: string;
    backupPath: string;
  }

  export interface RestorePlan {
    entries: BackupEntry[];
    createdAt: string;
    source: string;
  }

  export interface RootPreparationRequest {
    avdName: string;
    serial: string;
    rootPackagePath: string;
  }

  export interface RootPreparationResult {
    normalizedPackagePath: string;
    fakeBootRemotePath: string;
    instructions: string[];
  }

  export interface RootFinalizeRequest {
    avdName: string;
    serial: string;
  }

  export interface RootFinalizeResult {
    restoredFiles: string[];
    nextBootRecommendation: string;
  }

  // ─── Automated root pipeline ────────────────────────────────────────────────

  export type RootSource = { type: 'localFile'; value: string } | { type: 'latestStable' };

  /** Latest official stable Magisk release metadata from the GitHub releases API. */
  export interface MagiskStableRelease {
    /** Human-readable version string (e.g. "Magisk v30.7"). */
    version: string;
    /** Git tag name (e.g. "v30.7"). */
    tag: string;
    /** Exact filename of the APK asset (e.g. "Magisk-v30.7.apk"). */
    assetName: string;
    /** Direct download URL for the APK. */
    downloadUrl: string;
    /** File size in bytes. */
    size: number;
    /** SHA-256 hex digest (without "sha256:" prefix), if provided by GitHub. */
    sha256: string | null;
    /** ISO-8601 publish timestamp. */
    publishedAt: string;
  }

  export interface RootAvdRequest {
    avdName: string;
    serial: string;
    source: RootSource;
  }

  export interface RootProgress {
    step: number;
    totalSteps: number;
    label: string;
    detail: string | null;
  }

  export interface RootAvdResult {
    magiskVersion: string;
    patchedRamdiskPath: string;
    managerInstalled: boolean;
  }

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
    contentLength: number;
    contentType: string | null;
    lastModified: string | null;
    server: string | null;
    etag: string | null;
    isZip: boolean;
    zipPayloadOffset: number | null;
    zipCompressedSize: number | null;
    zipUncompressedSize: number | null;
    zipCompressionMethod: string | null;
    blockSize: number;
    payloadVersion: number;
    minorVersion: number | null;
    securityPatchLevel: string | null;
    maxTimestamp: number | null;
    partialUpdate: boolean | null;
    dynamicGroups: DynamicGroupInfo[];
    partitionCount: number;
    totalSize: number;
    otaType: string | null;
    preDevice: string | null;
    postBuild: string | null;
    postBuildIncremental: string | null;
    postSdkLevel: string | null;
    postSecurityPatchLevel: string | null;
    postTimestamp: string | null;
    otaVersion: string | null;
    wipe: boolean | null;
    fileHash: string | null;
    fileSize: number | null;
    metadataHash: string | null;
    metadataSize: number | null;
  }

  export interface DynamicGroupInfo {
    name: string;
    size: number | null;
    partitions: string[];
  }

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

  export type ProviderSource = 'F-Droid' | 'GitHub' | 'Aptoide';
  export type MarketplaceSortBy = 'relevance' | 'name' | 'recentlyUpdated' | 'downloads';

  export interface MarketplaceApp {
    name: string;
    packageName: string;
    version: string;
    summary: string;
    iconUrl: string | null;
    source: string;
    availableSources: string[];
    downloadUrl: string | null;
    repoUrl: string | null;
    size: number | null;
    rating: number | null;
    downloadsCount: number | null;
    malwareStatus: string | null;
    categories: string[];
    updatedAt: string | null;
    installable: boolean;
    language: string | null;
  }

  export interface MarketplaceAppDetail {
    name: string;
    packageName: string;
    version: string;
    description: string;
    iconUrl: string | null;
    source: string;
    downloadUrl: string | null;
    repoUrl: string | null;
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
    updatedAt: string | null;
  }

  export interface VersionInfo {
    versionName: string;
    versionCode: number;
    size: number | null;
    downloadUrl: string | null;
    publishedAt: string | null;
  }

  export interface GithubRateLimitSummary {
    limit: number;
    remaining: number;
    resetAt: string | null;
  }

  export interface GithubUserSummary {
    login: string;
    avatarUrl: string | null;
    profileUrl: string | null;
  }

  export interface GithubDeviceFlowChallenge {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string | null;
    expiresIn: number;
    interval: number;
  }

  export interface GithubDeviceFlowPollResult {
    status: string;
    accessToken: string | null;
    interval: number | null;
    message: string | null;
    user: GithubUserSummary | null;
    rateLimit: GithubRateLimitSummary | null;
  }

  export interface MarketplaceSearchFilters {
    providers: ProviderSource[];
    sortBy: MarketplaceSortBy;
    githubToken?: string | null;
    resultsPerProvider?: number;
  }
}
