package backend

import "context"

// ADBExecutor defines the interface for ADB operations.
// This interface enables mocking for unit tests.
type ADBExecutor interface {
	// Device discovery
	GetDevices() ([]Device, error)
	GetDeviceInfo() (DeviceInfo, error)
	GetDeviceMode() (string, error)

	// Device control
	Reboot(mode string) error

	// Package management
	InstallPackage(filePath string) (string, error)
	UninstallPackage(packageName string) (string, error)
	GetInstalledPackages() ([]InstalledPackage, error)

	// File operations
	ListFiles(path string) ([]FileEntry, error)
	PushFile(localPath string, remotePath string) (string, error)
	PullFile(remotePath string, localPath string) (string, error)

	// Sideload
	SideloadPackage(filePath string) (string, error)

	// Wireless ADB
	EnableWirelessAdb(port string) (string, error)
	ConnectWirelessAdb(ipAddress string, port string) (string, error)
	DisconnectWirelessAdb(ipAddress string, port string) (string, error)

	// Shell commands
	RunShellCommand(command string) (string, error)
	RunAdbHostCommand(args string) (string, error)
}

// FastbootExecutor defines the interface for Fastboot operations.
// This interface enables mocking for unit tests.
type FastbootExecutor interface {
	// Device discovery
	GetFastbootDevices() ([]Device, error)

	// Flash operations
	FlashPartition(partition string, filePath string) error
	WipeData() error

	// Slot management
	SetActiveSlot(slot string) error

	// Variables
	GetBootloaderVariables() (string, error)

	// Commands
	RunFastbootHostCommand(args string) (string, error)
}

// PayloadExtractor defines the interface for payload extraction operations.
type PayloadExtractor interface {
	SetContext(ctx context.Context)
	ExtractPayload(payloadPath string, outputDir string, selectedPartitions []string) (*ExtractPayloadResult, error)
	ListPartitions(payloadPath string) ([]string, error)
}

// DialogService defines the interface for native dialog operations.
type DialogService interface {
	SelectImageFile() (string, error)
	SelectApkFile() (string, error)
	SelectMultipleApkFiles() ([]string, error)
	SelectZipFile() (string, error)
	SelectFileToPush() (string, error)
	SelectSaveDirectory(defaultFilename string) (string, error)
	SelectDirectoryForPull() (string, error)
	SelectDirectoryToPush() (string, error)
	SelectPayloadFile() (string, error)
	SelectOutputDirectory() (string, error)
}

// Compile-time interface satisfaction checks.
// These ensure the App struct implements all defined interfaces.
var (
	_ ADBExecutor      = (*App)(nil)
	_ FastbootExecutor = (*App)(nil)
	_ DialogService    = (*App)(nil)
)

// PayloadService implements PayloadExtractor
var _ PayloadExtractor = (*PayloadService)(nil)
