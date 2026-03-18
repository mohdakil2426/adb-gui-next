//go:build linux
// +build linux

package backend

import "embed"

//go:embed bin/linux
var platformBinaries embed.FS

const platformDir = "bin/linux"
