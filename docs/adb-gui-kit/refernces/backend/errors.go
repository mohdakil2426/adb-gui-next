package backend

import "errors"

// Sentinel errors for common error conditions.
// These allow callers to identify specific error types using errors.Is().
var (
	// ErrEmptyCommand indicates that an empty command was provided.
	ErrEmptyCommand = errors.New("command cannot be empty")

	// ErrEmptyIPAddress indicates that an IP address was not provided.
	ErrEmptyIPAddress = errors.New("IP address cannot be empty")

	// ErrEmptyFilePath indicates that a file path was not provided.
	ErrEmptyFilePath = errors.New("file path cannot be empty")

	// ErrEmptyPartition indicates that a partition name was not provided.
	ErrEmptyPartition = errors.New("partition name cannot be empty")

	// ErrNoDevice indicates that no device is connected.
	ErrNoDevice = errors.New("no device connected")

	// ErrDeviceNotInADB indicates the device is not in ADB mode.
	ErrDeviceNotInADB = errors.New("device not in ADB mode")

	// ErrDeviceNotInFastboot indicates the device is not in fastboot mode.
	ErrDeviceNotInFastboot = errors.New("device not in fastboot mode")

	// ErrBinaryNotFound indicates that a required binary was not found.
	ErrBinaryNotFound = errors.New("binary not found")

	// ErrContextNotInitialized indicates that the application context is nil.
	ErrContextNotInitialized = errors.New("application context not initialized")

	// ErrFileNotFound indicates that a file does not exist.
	ErrFileNotFound = errors.New("file not found")

	// ErrConnectionFailed indicates that a connection attempt failed.
	ErrConnectionFailed = errors.New("connection failed")

	// ErrExtractionFailed indicates that extraction operation failed.
	ErrExtractionFailed = errors.New("extraction failed")
)
