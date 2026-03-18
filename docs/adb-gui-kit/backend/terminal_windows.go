//go:build windows
// +build windows

package backend

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// launchTerminal opens a new terminal window in the adb-gui-kit-bin directory
// Priority: Windows Terminal > PowerShell > cmd.exe
func launchTerminal() error {
	var binDir string

	// Check if we're in dev mode (backend/bin/windows exists relative to executable)
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		// In dev mode, binary is in project root, so backend/bin/windows is accessible
		devBinDir := filepath.Join(exeDir, "backend", "bin", "windows")
		if info, err := os.Stat(devBinDir); err == nil && info.IsDir() {
			binDir = devBinDir
		}
	}

	// If not in dev mode, use extracted binaries from temp
	if binDir == "" {
		binDir, err = extractBinaries()
		if err != nil {
			// Fallback to temp directory if extraction fails
			binDir = filepath.Join(os.TempDir(), "adb-gui-kit-bin")
		}
	}

	// Ensure the directory exists
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create binaries directory: %w", err)
	}

	// Try Windows Terminal first (modern, preferred)
	// Use -d flag to set starting directory
	cmd := exec.Command("cmd", "/c", "start", "wt.exe", "-d", binDir)
	setCommandWindowMode(cmd)

	if err := cmd.Start(); err == nil {
		return nil
	}

	// Fallback to PowerShell with working directory
	// Use Start-Process to launch in new window with working directory
	psCmd := fmt.Sprintf("Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd ''%s''' -WorkingDirectory '%s'", binDir, binDir)
	cmd = exec.Command("powershell.exe", "-Command", psCmd)
	setCommandWindowMode(cmd)

	if err := cmd.Start(); err == nil {
		return nil
	}

	// Final fallback to cmd.exe with /K to keep window open
	// Use start to open new window, then change directory
	cmd = exec.Command("cmd", "/c", "start", "cmd.exe", "/K", fmt.Sprintf("cd /d \"%s\"", binDir))
	setCommandWindowMode(cmd)

	return cmd.Start()
}
