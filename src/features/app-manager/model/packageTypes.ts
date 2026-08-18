export interface DetailedPackageInfo {
  apkPath: string;
  dataDir: string;
  deniedPermissions: string[];
  grantedPermissions: string[];
  installer: string | null;
  isEnabled: boolean;
  isSystem: boolean;
  label: string;
  minSdk: number;
  name: string;
  signatures: string[];
  splitPaths: string[];
  targetSdk: number;
  versionCode: string;
  versionName: string;
}

export type PackageLifecycleOp =
  | 'launch'
  | 'force_stop'
  | 'clear_data'
  | 'clear_cache'
  | 'disable'
  | 'enable';

export interface StorageConsumer {
  appSize: number;
  cacheSize: number;
  dataSize: number;
  label: string;
  packageName: string;
  totalSize: number;
}
