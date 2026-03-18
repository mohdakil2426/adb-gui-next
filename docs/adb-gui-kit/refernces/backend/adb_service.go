package backend

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// DeviceMode represents the connection mode of an Android device.
type DeviceMode string

const (
	// DeviceModeUnknown indicates the device mode could not be determined.
	DeviceModeUnknown DeviceMode = "unknown"
	// DeviceModeADB indicates the device is connected via ADB.
	DeviceModeADB DeviceMode = "adb"
	// DeviceModeFastboot indicates the device is in fastboot/bootloader mode.
	DeviceModeFastboot DeviceMode = "fastboot"
)

// GetDevices returns a list of devices connected via ADB.
func (a *App) GetDevices() ([]Device, error) {
	output, err := a.runCommand(BinaryADB, "devices")
	if err != nil {
		return nil, fmt.Errorf("get ADB devices: %w", err)
	}

	var devices []Device
	lines := strings.Split(output, "\n")

	if len(lines) > 1 {
		for _, line := range lines[1:] {
			parts := strings.Fields(line)
			if len(parts) == 2 {
				devices = append(devices, Device{
					Serial: parts[0],
					Status: parts[1],
				})
			}
		}
	}

	return devices, nil
}

// getProp retrieves an Android system property via ADB.
func (a *App) getProp(prop string) string {
	output, err := a.runCommand(BinaryADB, "shell", "getprop", prop)
	if err != nil {
		return ValueNotAvailable
	}
	return strings.TrimSpace(output)
}

// checkRootStatus checks if the device has root access.
func (a *App) checkRootStatus() string {
	output, err := a.runCommand(BinaryADB, "shell", "su", "-c", "id -u")
	cleanOutput := strings.TrimSpace(output)
	if err == nil && cleanOutput == "0" {
		return "Yes"
	}
	return "No"
}

// getIPAddress retrieves the device's WiFi IP address.
func (a *App) getIPAddress() string {
	output, err := a.runCommand(BinaryADB, "shell", "ip", "addr", "show", "wlan0")
	if err == nil {
		re := regexp.MustCompile(`inet (\d+\.\d+\.\d+\.\d+)/\d+`)
		matches := re.FindStringSubmatch(output)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	ip := a.getProp("dhcp.wlan0.ipaddress")
	if ip != ValueNotAvailable && ip != "" {
		return ip
	}

	return ValueNotAvailableWiFi
}

// getRamTotal retrieves the total RAM of the device.
func (a *App) getRamTotal() string {
	output, err := a.runCommand(BinaryADB, "shell", "cat /proc/meminfo | grep MemTotal")
	if err != nil {
		return ValueNotAvailable
	}

	re := regexp.MustCompile(`MemTotal:\s*(\d+)\s*kB`)
	matches := re.FindStringSubmatch(output)
	if len(matches) < 2 {
		return ValueNotAvailable
	}

	kb, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return ValueNotAvailable
	}

	gb := kb / 1024 / 1024
	return fmt.Sprintf("%.1f GB", gb)
}

// getStorageInfo retrieves storage usage information from the device.
func (a *App) getStorageInfo() string {
	output, err := a.runCommand(BinaryADB, "shell", "df /data")
	if err != nil {
		return ValueNotAvailable
	}

	lines := strings.Split(output, "\n")
	if len(lines) < 2 {
		return ValueNotAvailable
	}

	fields := strings.Fields(lines[1])
	if len(fields) < 4 {
		return ValueNotAvailable
	}

	totalKB, errTotal := strconv.ParseFloat(fields[1], 64)
	usedKB, errUsed := strconv.ParseFloat(fields[2], 64)

	if errTotal != nil || errUsed != nil {
		return ValueNotAvailable
	}

	totalGB := totalKB / 1024 / 1024
	usedGB := usedKB / 1024 / 1024

	return fmt.Sprintf("%.1f GB / %.1f GB", usedGB, totalGB)
}

// GetDeviceInfo retrieves comprehensive information about the connected device.
func (a *App) GetDeviceInfo() (DeviceInfo, error) {
	var info DeviceInfo

	info.Model = a.getProp("ro.product.model")
	info.AndroidVersion = a.getProp("ro.build.version.release")
	info.BuildNumber = a.getProp("ro.build.id")
	info.Codename = a.getProp("ro.product.device")
	info.IPAddress = a.getIPAddress()
	info.RootStatus = a.checkRootStatus()
	info.RamTotal = a.getRamTotal()
	info.StorageInfo = a.getStorageInfo()
	info.Brand = a.getProp("ro.product.brand")
	info.DeviceName = a.getProp("ro.product.name")

	if serial, err := a.runCommand(BinaryADB, "get-serialno"); err == nil {
		info.Serial = strings.TrimSpace(serial)
	} else {
		info.Serial = strings.TrimSpace(a.getProp("ro.serialno"))
	}

	batteryOutput, err := a.runShellCommand("dumpsys battery | grep level")
	if err != nil {
		info.BatteryLevel = ValueNotAvailable
	} else {
		re := regexp.MustCompile(`:\s*(\d+)`)
		matches := re.FindStringSubmatch(batteryOutput)
		if len(matches) > 1 {
			info.BatteryLevel = matches[1] + "%"
		} else {
			info.BatteryLevel = ValueNotAvailable
		}
	}

	return info, nil
}

// detectDeviceMode determines whether a device is connected via ADB or fastboot.
func (a *App) detectDeviceMode() (DeviceMode, error) {
	adbDevices, adbErr := a.GetDevices()
	if adbErr == nil {
		for _, device := range adbDevices {
			status := strings.ToLower(strings.TrimSpace(device.Status))
			switch status {
			case StatusDevice, StatusRecovery, StatusSideload:
				return DeviceModeADB, nil
			}
		}
	}

	fastbootDevices, fastbootErr := a.GetFastbootDevices()
	if fastbootErr == nil && len(fastbootDevices) > 0 {
		return DeviceModeFastboot, nil
	}

	if adbErr != nil && fastbootErr != nil {
		return DeviceModeUnknown, fmt.Errorf("detect device mode: adb: %w, fastboot: %v", adbErr, fastbootErr)
	}

	return DeviceModeUnknown, nil
}

// GetDeviceMode returns the current device connection mode as a string.
func (a *App) GetDeviceMode() (string, error) {
	mode, err := a.detectDeviceMode()
	return string(mode), err
}

// Reboot reboots the device to the specified mode.
// Supported modes: "", "bootloader", "recovery", "fastboot".
func (a *App) Reboot(mode string) error {
	connectionMode, detectionErr := a.detectDeviceMode()
	if detectionErr != nil {
		return fmt.Errorf("reboot: %w", detectionErr)
	}

	mode = strings.TrimSpace(mode)

	switch connectionMode {
	case DeviceModeADB:
		args := []string{"reboot"}
		if mode != "" {
			args = append(args, mode)
		}
		_, err := a.runCommand(BinaryADB, args...)
		if err != nil {
			return fmt.Errorf("adb reboot: %w", err)
		}
		return nil

	case DeviceModeFastboot:
		if mode == "bootloader" {
			_, err := a.runCommand(BinaryFastboot, "reboot-bootloader")
			if err != nil {
				return fmt.Errorf("fastboot reboot-bootloader: %w", err)
			}
			return nil
		}
		args := []string{"reboot"}
		if mode != "" {
			args = append(args, mode)
		}
		_, err := a.runCommand(BinaryFastboot, args...)
		if err != nil {
			return fmt.Errorf("fastboot reboot: %w", err)
		}
		return nil

	default:
		return ErrNoDevice
	}
}

// InstallPackage installs an APK or APKS on the connected device.
func (a *App) InstallPackage(filePath string) (string, error) {
	if filePath == "" {
		return "", ErrEmptyFilePath
	}

	// Handle .apks files (split APKs)
	if strings.HasSuffix(strings.ToLower(filePath), ".apks") {
		return a.installApksInternal(filePath)
	}

	output, err := a.runCommand(BinaryADB, "install", "-r", filePath)
	if err != nil {
		return "", fmt.Errorf("install package %q: %w (output: %s)", filePath, err, output)
	}
	return output, nil
}

// installApksInternal handles the extraction and installation of split APKs (.apks).
func (a *App) installApksInternal(filePath string) (string, error) {
	// Create a temp directory for extraction
	tempDir := filepath.Join(os.TempDir(), TempDirName, "apks-extract-"+strconv.FormatInt(time.Now().UnixNano(), 36))
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", fmt.Errorf("create temp extraction dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Open the .apks file (which is a ZIP archive)
	zipReader, err := zip.OpenReader(filePath)
	if err != nil {
		return "", fmt.Errorf("open .apks file as zip: %w", err)
	}
	defer zipReader.Close()

	var extractedApks []string

	// Extract all .apk files from the archive
	for _, file := range zipReader.File {
		if !strings.HasSuffix(strings.ToLower(file.Name), ".apk") {
			continue
		}

		// Some .apks files have structures like splits/base.apk, etc.
		// We flatten it into our temp directory.
		fileName := filepath.Base(file.Name)
		dstPath := filepath.Join(tempDir, fileName)

		// Create the destination file
		dstFile, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			return "", fmt.Errorf("create extracted file %q: %w", fileName, err)
		}

		// Open the source file in ZIP
		srcFile, err := file.Open()
		if err != nil {
			dstFile.Close()
			return "", fmt.Errorf("open file in zip %q: %w", file.Name, err)
		}

		// Copy content
		_, copyErr := io.Copy(dstFile, srcFile)
		srcFile.Close()
		dstFile.Close()

		if copyErr != nil {
			return "", fmt.Errorf("extract file %q: %w", fileName, copyErr)
		}

		extractedApks = append(extractedApks, dstPath)
	}

	if len(extractedApks) == 0 {
		return "", fmt.Errorf("no .apk files found in .apks archive")
	}

	// Prepare arguments for adb install-multiple
	args := []string{"install-multiple", "-r"}
	args = append(args, extractedApks...)

	// Execute adb install-multiple
	output, err := a.runCommand(BinaryADB, args...)
	if err != nil {
		return "", fmt.Errorf("adb install-multiple: %w (output: %s)", err, output)
	}

	return output, nil
}

// UninstallPackage removes a package from the connected device.
func (a *App) UninstallPackage(packageName string) (string, error) {
	if packageName == "" {
		return "", ErrEmptyCommand
	}

	output, err := a.runCommand(BinaryADB, "shell", "pm", "uninstall", packageName)
	if err != nil {
		return "", fmt.Errorf("uninstall package %q: %w (output: %s)", packageName, err, output)
	}
	return output, nil
}

// GetInstalledPackages returns a list of installed packages on the device.
func (a *App) GetInstalledPackages() ([]InstalledPackage, error) {
	output, err := a.runCommand(BinaryADB, "shell", "pm", "list", "packages")
	if err != nil {
		return nil, fmt.Errorf("get installed packages: %w", err)
	}

	var packages []InstalledPackage
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		packageName := strings.TrimPrefix(line, "package:")
		if packageName != line {
			packages = append(packages, InstalledPackage{
				Name: packageName,
			})
		}
	}

	return packages, nil
}

// ListFiles lists files in the specified directory on the device.
func (a *App) ListFiles(path string) ([]FileEntry, error) {
	output, err := a.runCommand(BinaryADB, "shell", "ls", "-lA", path)
	if err != nil {
		return nil, fmt.Errorf("list files at %q: %w (output: %s)", path, err, output)
	}

	var files []FileEntry
	lines := strings.Split(output, "\n")

	spaceRegex := regexp.MustCompile(`\s+`)

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		if line == "" || strings.HasPrefix(line, "total") {
			continue
		}

		parts := spaceRegex.Split(line, 9)
		if len(parts) < 8 {
			continue
		}

		permissions := parts[0]
		fileType := "File"
		size := ""
		if len(parts) > 4 {
			size = parts[4]
		}

		if len(permissions) > 0 {
			switch permissions[0] {
			case 'd':
				fileType = "Directory"
			case 'l':
				fileType = "Symlink"
			}
		}

		if fileType == "Symlink" {
			// hide the raw block size for symlinks; the target is more interesting
			size = ""
		}

		var name string
		var date string
		var time string

		switch {
		case len(parts) >= 8:
			date = parts[5]
			time = parts[6]
			name = strings.Join(parts[7:], " ")
		case len(parts) == 7:
			date = parts[5]
			name = parts[6]
		case len(parts) == 6:
			name = parts[5]
		}

		if name == "" && len(parts) > 0 {
			// Fall back to the tail components so we still render something useful
			name = parts[len(parts)-1]
			if len(parts) >= 3 {
				time = parts[len(parts)-2]
				date = parts[len(parts)-3]
			}
		}

		name = strings.TrimSpace(name)
		date = strings.TrimSpace(date)
		time = strings.TrimSpace(time)

		if fileType == "Symlink" {
			linkParts := strings.Split(name, " -> ")
			name = linkParts[0]
		}

		files = append(files, FileEntry{
			Name:        name,
			Type:        fileType,
			Size:        size,
			Permissions: permissions,
			Date:        date,
			Time:        time,
		})
	}

	return files, nil
}

// PushFile copies a local file to the device.
func (a *App) PushFile(localPath string, remotePath string) (string, error) {
	if localPath == "" || remotePath == "" {
		return "", ErrEmptyFilePath
	}

	output, err := a.runCommand(BinaryADB, "push", localPath, remotePath)
	if err != nil {
		return "", fmt.Errorf("push file %q to %q: %w (output: %s)", localPath, remotePath, err, output)
	}
	return output, nil
}

// PullFile copies a file from the device to local storage.
func (a *App) PullFile(remotePath string, localPath string) (string, error) {
	if remotePath == "" || localPath == "" {
		return "", ErrEmptyFilePath
	}

	output, err := a.runCommand(BinaryADB, "pull", "-a", remotePath, localPath)
	if err != nil {
		return "", fmt.Errorf("pull file %q to %q: %w (output: %s)", remotePath, localPath, err, output)
	}
	return output, nil
}

// SideloadPackage sideloads an OTA package in recovery mode.
func (a *App) SideloadPackage(filePath string) (string, error) {
	filePath = strings.TrimSpace(filePath)
	if filePath == "" {
		return "", ErrEmptyFilePath
	}

	output, err := a.runCommand(BinaryADB, "sideload", filePath)
	if err != nil {
		return "", fmt.Errorf("sideload package %q: %w (output: %s)", filePath, err, output)
	}

	return output, nil
}

// EnableWirelessAdb enables wireless ADB on the specified port.
func (a *App) EnableWirelessAdb(port string) (string, error) {
	if port == "" {
		port = DefaultADBPort
	}

	output, err := a.runCommand(BinaryADB, "tcpip", port)
	if err != nil {
		return "", fmt.Errorf("enable tcpip on port %s (is device connected via USB?): %w (output: %s)", port, err, output)
	}

	return output, nil
}

// ConnectWirelessAdb connects to a device via wireless ADB.
func (a *App) ConnectWirelessAdb(ipAddress string, port string) (string, error) {
	if ipAddress == "" {
		return "", ErrEmptyIPAddress
	}
	if port == "" {
		port = DefaultADBPort
	}

	address := fmt.Sprintf("%s:%s", ipAddress, port)

	output, _ := a.runCommand(BinaryADB, "connect", address)

	cleanOutput := strings.TrimSpace(output)

	if strings.Contains(cleanOutput, "connected to") || strings.Contains(cleanOutput, "already connected to") {
		return cleanOutput, nil
	}

	if cleanOutput == "" {
		return "", fmt.Errorf("%w: no device found at %s", ErrConnectionFailed, address)
	}

	return "", fmt.Errorf("%w: %s", ErrConnectionFailed, cleanOutput)
}

// DisconnectWirelessAdb disconnects from a wireless ADB device.
func (a *App) DisconnectWirelessAdb(ipAddress string, port string) (string, error) {
	if ipAddress == "" {
		return "", ErrEmptyIPAddress
	}
	if port == "" {
		port = DefaultADBPort
	}

	address := fmt.Sprintf("%s:%s", ipAddress, port)

	output, err := a.runCommand(BinaryADB, "disconnect", address)
	if err != nil {
		output, err = a.runCommand(BinaryADB, "disconnect", ipAddress)
		if err != nil {
			return "", fmt.Errorf("disconnect from %s: %w (output: %s)", address, err, output)
		}
	}

	cleanOutput := strings.TrimSpace(output)
	if cleanOutput == "" {
		return fmt.Sprintf("Disconnected from %s", address), nil
	}

	return cleanOutput, nil
}

// RunShellCommand executes a shell command on the connected device.
func (a *App) RunShellCommand(command string) (string, error) {
	if command == "" {
		return "", ErrEmptyCommand
	}

	output, err := a.runShellCommand(command)
	if err != nil {
		return "", fmt.Errorf("shell command %q: %w (output: %s)", command, err, output)
	}

	return output, nil
}

// RunAdbHostCommand executes an ADB host command.
func (a *App) RunAdbHostCommand(args string) (string, error) {
	if args == "" {
		return "", ErrEmptyCommand
	}

	argSlice := strings.Fields(args)

	output, err := a.runCommand(BinaryADB, argSlice...)
	if err != nil {
		return "", fmt.Errorf("adb %s: %w (output: %s)", args, err, output)
	}

	return output, nil
}
