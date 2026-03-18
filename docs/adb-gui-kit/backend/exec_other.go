//go:build linux
// +build linux

package backend

import "os/exec"

func setCommandWindowMode(cmd *exec.Cmd) {
	// no-op for non-Windows platforms
	_ = cmd
}

// openFolderInExplorer opens a folder in the default file manager on Linux.
func openFolderInExplorer(folderPath string) error {
	cmd := exec.Command("xdg-open", folderPath)
	return cmd.Start()
}
