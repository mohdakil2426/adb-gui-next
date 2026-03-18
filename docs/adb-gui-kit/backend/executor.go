package backend

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

var (
	// Cache extraction to avoid re-doing it every call
	extractionOnce sync.Once
	extractedPath  string
	extractionErr  error
)

// DefaultCommandTimeout is the default timeout for command execution.
const DefaultCommandTimeout = 5 * time.Minute

// extractBinaries extracts embedded binaries to a temp folder.
// This function is safe to call multiple times; extraction only occurs once.
func extractBinaries() (string, error) {
	extractionOnce.Do(func() {
		// Create a temp directory
		tempDir := filepath.Join(os.TempDir(), TempDirName)
		if err := os.MkdirAll(tempDir, 0755); err != nil {
			extractionErr = fmt.Errorf("create temp dir: %w", err)
			return
		}

		// Dynamically read all files from the embedded directory
		entries, err := platformBinaries.ReadDir(platformDir)
		if err != nil {
			extractionErr = fmt.Errorf("read embedded directory: %w", err)
			return
		}

		// Extract all files from the embedded directory
		for _, entry := range entries {
			if entry.IsDir() {
				continue // Skip subdirectories
			}

			fileName := entry.Name()
			srcPath := platformDir + "/" + fileName

			// Open source file
			src, err := platformBinaries.Open(srcPath)
			if err != nil {
				// If we can't find it in embed, skip it
				continue
			}

			dstPath := filepath.Join(tempDir, fileName)
			dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
			if err != nil {
				src.Close() // Close source before returning
				extractionErr = fmt.Errorf("open dst file %q: %w", fileName, err)
				return
			}

			// Copy file contents
			_, copyErr := io.Copy(dst, src)

			// Close files immediately (not deferred)
			src.Close()
			dst.Close()

			// Check for copy error after closing files
			if copyErr != nil {
				extractionErr = fmt.Errorf("copy file %q: %w", fileName, copyErr)
				return
			}
		}

		extractedPath = tempDir
	})

	return extractedPath, extractionErr
}

// getBinaryPath locates the binary for the given name.
// It checks embedded binaries, installation directory, and system PATH.
func (a *App) getBinaryPath(name string) (string, error) {
	platformDir := runtime.GOOS

	switch platformDir {
	case "windows":
		extension := ".exe"

		// 0. Try to extract embedded binaries if this is a standalone build
		tempBinDir, err := extractBinaries()
		if err == nil && tempBinDir != "" {
			candidate := filepath.Join(tempBinDir, name+extension)
			if _, err := os.Stat(candidate); err == nil {
				return candidate, nil
			}
		}

		// 1. Check side-by-side with the executable (most robust for portable builds)
		//    We check both structured (bin/windows/adb.exe) and flat (adb.exe) layouts.
		exePath, err := os.Executable()
		if err != nil {
			return "", fmt.Errorf("get executable path: %w", err)
		}
		installDir := filepath.Dir(exePath)

		candidates := []string{
			// Best practice: structured inside bin/windows
			filepath.Join(installDir, "bin", platformDir, name+extension),
			// Fallback: flat in bin/
			filepath.Join(installDir, "bin", name+extension),
			// Fallback: flat alongside executable
			filepath.Join(installDir, name+extension),
			// Dev environment / relative path
			filepath.Join(".", "bin", platformDir, name+extension),
		}

		// Check all candidate paths
		for _, candidate := range candidates {
			if candidate == "" {
				continue
			}
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				if filepath.IsAbs(candidate) {
					return candidate, nil
				}
				return filepath.Abs(candidate)
			}
		}

		// 2. Final Fallback: Check system PATH
		//    This allows the app to work if the user has ADB installed globally,
		//    even if the bundled bin folder is missing.
		if path, err := exec.LookPath(name + extension); err == nil {
			return path, nil
		}

	default:
		// Linux and other Unix-like systems
		// Check system PATH for installed binaries
		if path, err := exec.LookPath(name); err == nil {
			return path, nil
		}

		return "", fmt.Errorf("%w: '%s' not found; install via package manager or ensure it's in PATH", ErrBinaryNotFound, name)
	}

	return "", fmt.Errorf("%w: '%s' not found for platform '%s'", ErrBinaryNotFound, name, platformDir)
}

// runCommand executes a command with the stored context.
// It uses the application context for cancellation support.
func (a *App) runCommand(name string, args ...string) (string, error) {
	return a.runCommandWithContext(a.ctx, name, args...)
}

// runCommandWithContext executes a command with the provided context.
// This allows for cancellation and timeout control.
func (a *App) runCommandWithContext(ctx context.Context, name string, args ...string) (string, error) {
	binaryPath, err := a.getBinaryPath(name)
	if err != nil {
		return "", err
	}

	// Use context for cancellation support; if nil, use background context with timeout
	if ctx == nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(context.Background(), DefaultCommandTimeout)
		defer cancel()
	}

	cmd := exec.CommandContext(ctx, binaryPath, args...)

	setCommandWindowMode(cmd)

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		// Check if context was cancelled
		if ctx.Err() == context.Canceled {
			return "", fmt.Errorf("command cancelled: %s", name)
		}
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("command timed out: %s", name)
		}
		return "", fmt.Errorf("run %s: %w (stderr: %s)", name, err, stderr.String())
	}

	// Combine stdout and stderr because tools like fastboot write info to stderr
	output := out.String()
	if stderr.Len() > 0 {
		if output != "" {
			output += "\n"
		}
		output += stderr.String()
	}

	return strings.TrimSpace(output), nil
}

// runShellCommand executes an ADB shell command.
func (a *App) runShellCommand(shellCommand string) (string, error) {
	return a.runShellCommandWithContext(a.ctx, shellCommand)
}

// runShellCommandWithContext executes an ADB shell command with context support.
func (a *App) runShellCommandWithContext(ctx context.Context, shellCommand string) (string, error) {
	binaryPath, err := a.getBinaryPath(BinaryADB)
	if err != nil {
		return "", err
	}

	// Use context for cancellation support
	if ctx == nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(context.Background(), DefaultCommandTimeout)
		defer cancel()
	}

	cmd := exec.CommandContext(ctx, binaryPath, "shell", shellCommand)

	setCommandWindowMode(cmd)

	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		if ctx.Err() == context.Canceled {
			return "", fmt.Errorf("shell command cancelled")
		}
		if ctx.Err() == context.DeadlineExceeded {
			return "", fmt.Errorf("shell command timed out")
		}
		return "", fmt.Errorf("adb shell %q: %w (stderr: %s)", shellCommand, err, stderr.String())
	}

	return strings.TrimSpace(out.String()), nil
}
