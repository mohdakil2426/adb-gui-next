export namespace backend {
  export type AvdRootState = 'stock' | 'rooted' | 'modified' | 'unknown';
  export type EmulatorBootMode = 'cold' | 'normal' | 'unknown';

  export interface AvdSummary {
    abi: string | null;
    apiLevel: number | null;
    avdPath: string;
    bootMode: EmulatorBootMode;
    deviceName: string | null;
    hasBackups: boolean;
    iniPath: string;
    isRunning: boolean;
    name: string;
    ramdiskPath: string | null;
    rootState: AvdRootState;
    serial: string | null;
    target: string | null;
    warnings: string[];
  }

  export interface EmulatorLaunchOptions {
    coldBoot: boolean;
    noBootAnim: boolean;
    noSnapshotLoad: boolean;
    noSnapshotSave: boolean;
    wipeData: boolean;
    writableSystem: boolean;
  }

  export interface BackupEntry {
    backupPath: string;
    originalPath: string;
  }

  export interface RestorePlan {
    createdAt: string;
    entries: BackupEntry[];
    source: string;
  }

  export interface RootPreparationRequest {
    avdName: string;
    rootPackagePath: string;
    serial: string;
  }

  export interface RootPreparationResult {
    fakeBootRemotePath: string;
    instructions: string[];
    normalizedPackagePath: string;
  }

  export interface RootFinalizeRequest {
    avdName: string;
    patchedImagePath?: string | null;
    serial: string | null;
  }

  export interface RootFinalizeResult {
    nextBootRecommendation: string;
    restoredFiles: string[];
  }

  // ─── Automated root pipeline ────────────────────────────────────────────────

  export type RootSource = { type: 'localFile'; value: string } | { type: 'latestStable' };

  /** Latest official stable Magisk release metadata from the GitHub releases API. */
  export interface MagiskStableRelease {
    /** Exact filename of the APK asset (e.g. "Magisk-v30.7.apk"). */
    assetName: string;
    /** Direct download URL for the APK. */
    downloadUrl: string;
    /** ISO-8601 publish timestamp. */
    publishedAt: string;
    /** SHA-256 hex digest (without "sha256:" prefix), if provided by GitHub. */
    sha256: string | null;
    /** File size in bytes. */
    size: number;
    /** Git tag name (e.g. "v30.7"). */
    tag: string;
    /** Human-readable version string (e.g. "Magisk v30.7"). */
    version: string;
  }

  export interface RootAvdRequest {
    avdName: string;
    serial: string;
    source: RootSource;
  }

  export interface RootProgress {
    detail: string | null;
    label: string;
    step: number;
    totalSteps: number;
  }

  export type RootActivationStatus = 'patchInstalled' | 'verified' | 'verificationFailed';

  export interface RootAvdResult {
    activationStatus: RootActivationStatus;
    magiskVersion: string;
    managerInstalled: boolean;
    message: string;
    patchedRamdiskPath: string;
  }

  export interface RootVerificationResult {
    bootCompleted: boolean;
    magiskPackage: string | null;
    message: string;
    status: RootActivationStatus;
    suUid: string | null;
  }

  // ─── Pre-flight readiness scan ──────────────────────────────────────────────

  export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

  export interface ReadinessCheck {
    detail: string | null;
    id: string;
    label: string;
    message: string;
    status: CheckStatus;
  }

  export type RecommendedAction =
    | { type: 'launchEmulator' }
    | { type: 'coldBoot' }
    | { type: 'restoreFirst' }
    | { type: 'unsupported'; reason: string };

  export interface RootReadinessScan {
    canProceed: boolean;
    checks: ReadinessCheck[];
    hasWarnings: boolean;
    recommendedAction: RecommendedAction | null;
  }

  export interface Device {
    serial: string;
    status: string;
  }

  export interface DeviceInfo {
    androidVersion: string;
    batteryLevel: string;
    brand: string;
    buildNumber: string;
    codename: string;
    deviceName: string;
    ipAddress: string;
    model: string;
    ramTotal: string;
    rootStatus: string;
    serial: string;
    storageInfo: string;
  }

  export interface ExtractionStats {
    durationMs: number;
    partitionsExtracted: number;
    throughputMbps: number;
    totalBytes: number;
  }

  export interface ProgressEvent {
    bytesWritten: number;
    completed: boolean;
    etaSeconds: number;
    operationIndex: number;
    partitionName: string;
    throughputMbps: number;
    totalBytes: number;
    totalOperations: number;
  }

  export interface ExtractPayloadResult {
    error?: string;
    extractedFiles: string[];
    outputDir: string;
    stats?: ExtractionStats;
    success: boolean;
  }

  export type CancelToken = string;

  export interface FileEntry {
    date: string;
    /** For symlinks: resolved target (e.g. "/proc/self/fd"). Empty for files/dirs. */
    linkTarget: string;
    name: string;
    permissions: string;
    size: string;
    time: string;
    type: string;
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
    contentType: string | null;
    etag: string | null;
    lastModified: string | null;
    server: string | null;
    supportsRanges: boolean;
  }

  /** Full metadata about a remote OTA payload — HTTP, ZIP, and OTA manifest layers. */
  export interface RemotePayloadMetadata {
    blockSize: number;
    contentLength: number;
    contentType: string | null;
    dynamicGroups: DynamicGroupInfo[];
    etag: string | null;
    fileHash: string | null;
    fileSize: number | null;
    isZip: boolean;
    lastModified: string | null;
    maxTimestamp: number | null;
    metadataHash: string | null;
    metadataSize: number | null;
    minorVersion: number | null;
    otaType: string | null;
    otaVersion: string | null;
    partialUpdate: boolean | null;
    partitionCount: number;
    payloadVersion: number;
    postBuild: string | null;
    postBuildIncremental: string | null;
    postSdkLevel: string | null;
    postSecurityPatchLevel: string | null;
    postTimestamp: string | null;
    preDevice: string | null;
    securityPatchLevel: string | null;
    server: string | null;
    totalSize: number;
    wipe: boolean | null;
    zipCompressedSize: number | null;
    zipCompressionMethod: string | null;
    zipPayloadOffset: number | null;
    zipUncompressedSize: number | null;
  }

  export interface DynamicGroupInfo {
    name: string;
    partitions: string[];
    size: number | null;
  }

  export interface OpsMetadata {
    cpu: string | null;
    encryption: string;
    firmwareName: string | null;
    flashType: string | null;
    format: string;
    projectId: string | null;
    sections: string[];
    totalPartitions: number;
    totalSize: number;
  }

  export interface PayloadDiagnostics {
    compressionTypes: string[];
    format: string;
    hasSha256Hashes: boolean;
    isSparse: boolean;
    manifestInfo: string;
    partitionCount: number;
    totalOperations: number;
    warnings: string[];
  }

  export interface DeltaPayloadOptions {
    outputDir?: string;
    sourceDir: string;
  }

  // ─── Marketplace ─────────────────────────────────────────────────────────

  export type ProviderSource = 'F-Droid' | 'GitHub' | 'Aptoide';
  export type MarketplaceSortBy = 'relevance' | 'name' | 'recentlyUpdated' | 'downloads';

  export interface MarketplaceApp {
    availableSources: string[];
    categories: string[];
    downloadsCount: number | null;
    downloadUrl: string | null;
    iconUrl: string | null;
    installable: boolean;
    language: string | null;
    malwareStatus: string | null;
    name: string;
    packageName: string;
    rating: number | null;
    repoUrl: string | null;
    size: number | null;
    source: string;
    summary: string;
    updatedAt: string | null;
    version: string;
  }

  export interface MarketplaceAppDetail {
    author: string | null;
    changelog: string | null;
    description: string;
    downloadsCount: number | null;
    downloadUrl: string | null;
    iconUrl: string | null;
    license: string | null;
    name: string;
    packageName: string;
    rating: number | null;
    repoForks: number | null;
    repoStars: number | null;
    repoUrl: string | null;
    screenshots: string[];
    size: number | null;
    source: string;
    sourcesAvailable: string[];
    updatedAt: string | null;
    version: string;
    versions: VersionInfo[];
  }

  export interface VersionInfo {
    downloadUrl: string | null;
    publishedAt: string | null;
    size: number | null;
    versionCode: number;
    versionName: string;
  }

  export interface GithubRateLimitSummary {
    limit: number;
    remaining: number;
    resetAt: string | null;
  }

  export interface GithubUserSummary {
    avatarUrl: string | null;
    login: string;
    profileUrl: string | null;
  }

  export interface GithubDeviceFlowChallenge {
    deviceCode: string;
    expiresIn: number;
    interval: number;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string | null;
  }

  export interface GithubDeviceFlowPollResult {
    accessToken: string | null;
    interval: number | null;
    message: string | null;
    rateLimit: GithubRateLimitSummary | null;
    status: string;
    user: GithubUserSummary | null;
  }

  export interface MarketplaceSearchFilters {
    githubToken?: string | null;
    providers: ProviderSource[];
    resultsPerProvider?: number;
    sortBy: MarketplaceSortBy;
  }

  // ── Debloater ──────────────────────────────────────────────────────────────

  export type DebloatList = 'Aosp' | 'Carrier' | 'Google' | 'Misc' | 'Oem' | 'Pending' | 'Unlisted';
  export type RemovalTier = 'Recommended' | 'Advanced' | 'Expert' | 'Unsafe' | 'Unlisted';
  export type PkgState = 'Enabled' | 'Disabled' | 'Uninstalled';
  export type DebloatAction = 'uninstall' | 'disable' | 'restore';

  export interface DebloatPackageRow {
    dependencies: string[];
    description: string;
    list: DebloatList;
    name: string;
    neededBy: string[];
    removal: RemovalTier;
    state: PkgState;
  }

  export interface DebloatListStatus {
    lastUpdated: string;
    source: string;
    totalEntries: number;
  }

  export interface DebloatActionResult {
    error: string | null;
    newState: PkgState;
    packageName: string;
    success: boolean;
  }

  export interface PackageSnapshot {
    name: string;
    state: PkgState;
  }

  export interface BackupSummary {
    createdAt: string;
    deviceId: string;
    fileName: string;
    packageCount: number;
  }

  export interface PerDeviceSettings {
    disableMode: boolean;
    expertMode: boolean;
    multiUserMode: boolean;
  }
}
