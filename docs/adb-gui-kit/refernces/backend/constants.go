package backend

// Default values and magic strings used throughout the backend.
const (
	// DefaultADBPort is the default port for wireless ADB connections.
	DefaultADBPort = "5555"

	// ValueNotAvailable is the placeholder for unavailable data.
	ValueNotAvailable = "N/A"

	// ValueNotAvailableWiFi is the placeholder when WiFi is not available.
	ValueNotAvailableWiFi = "N/A (Not on WiFi?)"

	// TempDirName is the name of the temporary directory for all app temp files.
	TempDirName = "adb-gui-kit-bin"

	// PayloadTempSubDir is the subdirectory for payload-related temp files.
	PayloadTempSubDir = "payload-temp"

	// LogsDirName is the name of the logs directory.
	LogsDirName = "logs"

	// DefaultLogPrefix is the default prefix for log files.
	DefaultLogPrefix = "log"

	// DefaultConcurrency is the default number of concurrent operations.
	DefaultConcurrency = 4
)

// Binary names used by the application.
const (
	BinaryADB      = "adb"
	BinaryFastboot = "fastboot"
)

// Device status strings.
const (
	StatusDevice       = "device"
	StatusRecovery     = "recovery"
	StatusSideload     = "sideload"
	StatusFastboot     = "fastboot"
	StatusUnauthorized = "unauthorized"
)
