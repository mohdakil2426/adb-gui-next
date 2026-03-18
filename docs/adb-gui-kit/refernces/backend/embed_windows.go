//go:build windows
// +build windows

package backend

import "embed"

//go:embed bin/windows
var platformBinaries embed.FS

const platformDir = "bin/windows"
