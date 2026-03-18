//go:build !windows && !linux
// +build !windows,!linux

package backend

import (
	"embed"
	"errors"
	"os/exec"
)

// Stub for unsupported platforms (e.g., macOS/darwin)
// This project currently only supports Windows and Linux.

//go:embed bin/.gitkeep
var platformBinaries embed.FS

const platformDir = "bin/unsupported"

// ErrUnsupportedPlatform is returned when running on an unsupported platform.
var ErrUnsupportedPlatform = errors.New("this platform is not supported; only Windows and Linux are supported")

// launchDeviceManager is not supported on this platform.
func launchDeviceManager() error {
	return ErrUnsupportedPlatform
}

// launchTerminal is not supported on this platform.
func launchTerminal() error {
	return ErrUnsupportedPlatform
}

// setCommandWindowMode is a no-op for unsupported platforms.
func setCommandWindowMode(cmd *exec.Cmd) {
	_ = cmd // no-op
}

// openFolderInExplorer is not supported on this platform.
func openFolderInExplorer(folderPath string) error {
	_ = folderPath // no-op
	return ErrUnsupportedPlatform
}
