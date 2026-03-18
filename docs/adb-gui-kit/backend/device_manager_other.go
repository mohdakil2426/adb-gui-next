//go:build linux
// +build linux

package backend

import (
	"os/exec"
)

// launchDeviceManager launches the system settings on Linux
func launchDeviceManager() error {
	// Try gnome-control-center first (GNOME desktop)
	cmd := exec.Command("gnome-control-center")
	if err := cmd.Start(); err == nil {
		return nil
	}

	// Fallback to KDE system settings
	cmd = exec.Command("systemsettings5")
	if err := cmd.Start(); err == nil {
		return nil
	}

	// Final fallback - try generic system settings
	cmd = exec.Command("xdg-settings", "list")
	return cmd.Start()
}
