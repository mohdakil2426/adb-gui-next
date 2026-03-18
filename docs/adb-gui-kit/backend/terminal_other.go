//go:build linux
// +build linux

package backend

import (
	"os"
	"os/exec"
	"path/filepath"
)

// launchTerminal opens a new terminal window on Linux in the adb-gui-kit-bin directory
func launchTerminal() error {
	var binDir string

	// Check if we're in dev mode (backend/bin/linux exists relative to executable)
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		// In dev mode, binary is in project root, so backend/bin/linux is accessible
		devBinDir := filepath.Join(exeDir, "backend", "bin", "linux")
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
		binDir = os.TempDir() // Final fallback
	}

	// Linux - try common terminals in priority order with working directory
	terminals := []string{"gnome-terminal", "konsole", "xterm"}
	for _, term := range terminals {
		if _, err := exec.LookPath(term); err == nil {
			var cmd *exec.Cmd
			switch term {
			case "gnome-terminal":
				cmd = exec.Command(term, "--working-directory="+binDir)
			case "konsole":
				cmd = exec.Command(term, "--workdir", binDir)
			default:
				// For xterm and others, set working directory via Cmd.Dir
				cmd = exec.Command(term)
				cmd.Dir = binDir
			}
			return cmd.Start()
		}
	}

	// Fallback to xterm with working directory
	cmd := exec.Command("xterm")
	cmd.Dir = binDir
	return cmd.Start()
}
