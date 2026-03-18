package backend

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// checkContext validates that the application context is initialized.
func (a *App) checkContext() error {
	if a.ctx == nil {
		return ErrContextNotInitialized
	}
	return nil
}

// SelectImageFile opens a native file picker restricted to *.img files.
func (a *App) SelectImageFile() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Image File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Image Files (*.img)",
				Pattern:     "*.img",
			},
		},
	})
	if err != nil {
		return "", err
	}

	return selectedPath, nil
}

// SelectApkFile opens a native file picker for APK files.
func (a *App) SelectApkFile() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select APK File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Android Package (*.apk)",
				Pattern:     "*.apk",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}

// SelectMultipleApkFiles allows selecting multiple APK and APKS files at once.
func (a *App) SelectMultipleApkFiles() ([]string, error) {
	if err := a.checkContext(); err != nil {
		return nil, err
	}

	selectedPaths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select App Files",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Android Apps (*.apk, *.apks)",
				Pattern:     "*.apk;*.apks",
			},
			{
				DisplayName: "Android Package (*.apk)",
				Pattern:     "*.apk",
			},
			{
				DisplayName: "APK Set (*.apks)",
				Pattern:     "*.apks",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	return selectedPaths, nil
}

// SelectZipFile opens a native file picker for ZIP archives.
func (a *App) SelectZipFile() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Update Package",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "ZIP Archives (*.zip)",
				Pattern:     "*.zip",
			},
		},
	})
	if err != nil {
		return "", err
	}

	return selectedPath, nil
}

// SelectFileToPush opens a native file picker for any file.
func (a *App) SelectFileToPush() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select File to Import",
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}

// SelectSaveDirectory opens a save file dialog with a default filename.
func (a *App) SelectSaveDirectory(defaultFilename string) (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Select Save Location",
		DefaultFilename: defaultFilename,
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}

// SelectDirectoryForPull opens a directory picker for download location.
func (a *App) SelectDirectoryForPull() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Download Location",
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}

// SelectDirectoryToPush opens a directory picker for folder import.
func (a *App) SelectDirectoryToPush() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Folder to Import",
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}

// SelectPayloadFile opens a native file picker for payload.bin or ZIP files.
func (a *App) SelectPayloadFile() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Payload File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Payload Files (*.bin, *.zip)",
				Pattern:     "*.bin;*.zip",
			},
			{
				DisplayName: "Payload Binary (*.bin)",
				Pattern:     "*.bin",
			},
			{
				DisplayName: "OTA Package (*.zip)",
				Pattern:     "*.zip",
			},
		},
	})
	if err != nil {
		return "", err
	}

	return selectedPath, nil
}

// SelectOutputDirectory opens a native directory picker for extraction output.
func (a *App) SelectOutputDirectory() (string, error) {
	if err := a.checkContext(); err != nil {
		return "", err
	}

	selectedPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Output Directory",
	})
	if err != nil {
		return "", err
	}
	return selectedPath, nil
}
