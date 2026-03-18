//go:build windows
// +build windows

package backend

import (
	"os/exec"
	"strings"
	"syscall"
)

func setCommandWindowMode(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

// openFolderInExplorer opens a folder in Windows Explorer.
func openFolderInExplorer(folderPath string) error {
	// Convert forward slashes to backslashes for Windows
	normalizedPath := strings.ReplaceAll(folderPath, "/", "\\")
	cmd := exec.Command("explorer", normalizedPath)
	// Explorer is a GUI app, we must NOT hide its window
	return cmd.Start()
}
