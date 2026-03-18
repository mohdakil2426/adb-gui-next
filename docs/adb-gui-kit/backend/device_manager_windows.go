//go:build windows
// +build windows

package backend

import (
	"os/exec"
)

// launchDeviceManager opens the Windows Device Manager using devmgmt.msc
func launchDeviceManager() error {
	// Use cmd.exe /c to launch the device manager
	// This ensures proper window handling
	cmd := exec.Command("cmd", "/c", "devmgmt.msc")

	// Set window mode to hide the cmd window
	setCommandWindowMode(cmd)

	// Start the process without waiting for it to complete
	return cmd.Start()
}
