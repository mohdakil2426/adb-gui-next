package backend

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// Device represents an Android device connection.
type Device struct {
	Serial string `json:"serial"`
	Status string `json:"status"`
}

// DeviceInfo contains comprehensive information about a connected device.
type DeviceInfo struct {
	Model          string `json:"model"`
	AndroidVersion string `json:"androidVersion"`
	BuildNumber    string `json:"buildNumber"`
	BatteryLevel   string `json:"batteryLevel"`
	Serial         string `json:"serial"`
	IPAddress      string `json:"ipAddress"`
	RootStatus     string `json:"rootStatus"`
	Codename       string `json:"codename"`
	RamTotal       string `json:"ramTotal"`
	StorageInfo    string `json:"storageInfo"`
	Brand          string `json:"brand"`
	DeviceName     string `json:"deviceName"`
}

// FileEntry represents a file or directory on the device.
type FileEntry struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Size        string `json:"size"`
	Permissions string `json:"permissions"`
	Date        string `json:"date"`
	Time        string `json:"time"`
}

// InstalledPackage represents an installed Android application.
type InstalledPackage struct {
	Name string `json:"name"`
}

// App is the main application struct for Wails bindings.
type App struct {
	ctx            context.Context
	payloadService *PayloadService
}

// NewApp creates a new App application struct.
func NewApp() *App {
	return &App{
		payloadService: NewPayloadService(),
	}
}

// Startup is called when the app starts.
// The context is saved for use with runtime methods.
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.payloadService.SetContext(ctx)
}

// Shutdown is called when the app is closing.
// Cleans up all temp files.
func (a *App) Shutdown(ctx context.Context) {
	fmt.Println("App shutdown: cleaning up temp files...")
	// Clean up cached payload extraction
	if a.payloadService != nil {
		a.payloadService.CleanupExtractedPayload()
	}
	// Clean up all payload temp files
	CleanupAllPayloadTemp()
	fmt.Println("App shutdown: cleanup complete")
}

// Greet returns a greeting for the given name.
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// SaveLog saves the provided log content to a file in the 'logs' directory.
// Returns the path to the saved log file.
func (a *App) SaveLog(content string, prefix string) (string, error) {
	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get working directory: %w", err)
	}

	// Create logs folder if not exists
	logsDir := filepath.Join(cwd, LogsDirName)
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return "", fmt.Errorf("create logs directory: %w", err)
	}

	// Use default prefix if not provided
	if prefix == "" {
		prefix = DefaultLogPrefix
	}

	// Generate filename with timestamp
	filename := fmt.Sprintf("%s_%s.txt", prefix, time.Now().Format("2006-01-02_15-04-05"))
	filePath := filepath.Join(logsDir, filename)

	// Write file
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("write log file: %w", err)
	}

	return filePath, nil
}

// LaunchDeviceManager launches the Windows Device Manager.
// This is a platform-specific feature.
func (a *App) LaunchDeviceManager() error {
	return launchDeviceManager()
}

// LaunchTerminal launches a new external terminal window.
func (a *App) LaunchTerminal() error {
	return launchTerminal()
}

// ExtractPayload extracts partitions from an Android OTA payload.bin file.
func (a *App) ExtractPayload(payloadPath string, outputDir string, selectedPartitions []string) (*ExtractPayloadResult, error) {
	return a.payloadService.ExtractPayload(payloadPath, outputDir, selectedPartitions)
}

// ListPayloadPartitions lists available partitions in a payload.bin file.
func (a *App) ListPayloadPartitions(payloadPath string) ([]string, error) {
	return a.payloadService.ListPartitions(payloadPath)
}

// ListPayloadPartitionsWithDetails lists partitions with size information.
func (a *App) ListPayloadPartitionsWithDetails(payloadPath string) ([]PartitionDetail, error) {
	return a.payloadService.ListPartitionsWithDetails(payloadPath)
}

// CleanupPayloadCache cleans up cached extracted payload files.
// Call this when selecting a new payload file to free temp space.
func (a *App) CleanupPayloadCache() {
	if a.payloadService != nil {
		a.payloadService.CleanupExtractedPayload()
	}
}

// OpenFolder opens a folder in the system file explorer.
func (a *App) OpenFolder(folderPath string) error {
	if folderPath == "" {
		return ErrEmptyFilePath
	}

	// Check if folder exists
	info, err := os.Stat(folderPath)
	if err != nil {
		return fmt.Errorf("folder not found: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("path is not a directory: %s", folderPath)
	}

	return openFolderInExplorer(folderPath)
}
