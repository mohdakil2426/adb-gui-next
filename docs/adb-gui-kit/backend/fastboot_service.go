package backend

import (
	"fmt"
	"strings"
)

// WipeData performs a factory reset on the connected fastboot device.
// It erases userdata and cache partitions.
func (a *App) WipeData() error {
	output, err := a.runCommand(BinaryFastboot, "-w")
	if err != nil {
		return fmt.Errorf("fastboot wipe: %w (output: %s)", err, output)
	}
	return nil
}

// FlashPartition flashes an image file to the specified partition.
func (a *App) FlashPartition(partition string, filePath string) error {
	if partition == "" {
		return ErrEmptyPartition
	}
	if filePath == "" {
		return ErrEmptyFilePath
	}

	output, err := a.runCommand(BinaryFastboot, "flash", partition, filePath)
	if err != nil {
		return fmt.Errorf("flash %q to %q: %w (output: %s)", filePath, partition, err, output)
	}
	return nil
}

// GetFastbootDevices returns a list of devices connected in fastboot mode.
func (a *App) GetFastbootDevices() ([]Device, error) {
	output, err := a.runCommand(BinaryFastboot, "devices")
	if err != nil {
		if output == "" {
			return []Device{}, nil
		}
		return nil, fmt.Errorf("get fastboot devices: %w", err)
	}

	var devices []Device
	lines := strings.Split(output, "\n")

	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 && parts[1] == StatusFastboot {
			devices = append(devices, Device{
				Serial: parts[0],
				Status: parts[1],
			})
		}
	}

	return devices, nil
}

// RunFastbootHostCommand executes a fastboot command with the given arguments.
func (a *App) RunFastbootHostCommand(args string) (string, error) {
	if args == "" {
		return "", ErrEmptyCommand
	}

	argSlice := strings.Fields(args)

	output, err := a.runCommand(BinaryFastboot, argSlice...)
	if err != nil {
		return "", fmt.Errorf("fastboot %s: %w (output: %s)", args, err, output)
	}

	return output, nil
}

// SetActiveSlot sets the active boot slot (A/B devices).
func (a *App) SetActiveSlot(slot string) error {
	if slot == "" {
		return fmt.Errorf("slot name cannot be empty")
	}

	output, err := a.runCommand(BinaryFastboot, "--set-active="+slot)
	if err != nil {
		return fmt.Errorf("set active slot %q: %w (output: %s)", slot, err, output)
	}
	return nil
}

// GetBootloaderVariables retrieves all fastboot variables from the device.
func (a *App) GetBootloaderVariables() (string, error) {
	output, err := a.runCommand(BinaryFastboot, "getvar", "all")
	if err != nil {
		// getvar all often returns "error" status but still returns useful output
		if output != "" {
			return output, nil
		}
		return "", fmt.Errorf("get bootloader variables: %w", err)
	}
	return output, nil
}
