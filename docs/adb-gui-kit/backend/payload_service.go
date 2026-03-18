package backend

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"adb-kit/backend/payload"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// PayloadService handles Android OTA payload extraction.
type PayloadService struct {
	ctx context.Context

	// Cache for extracted payload.bin from ZIP files
	mu                     sync.Mutex
	cachedZipPath          string // Original ZIP file path
	cachedExtractedPayload string // Path to extracted payload.bin
}

// NewPayloadService creates a new payload service instance.
func NewPayloadService() *PayloadService {
	return &PayloadService{}
}

// SetContext sets the Wails runtime context for the service.
func (p *PayloadService) SetContext(ctx context.Context) {
	p.ctx = ctx
}

// getPayloadTempDir returns the temp directory for payload files.
func getPayloadTempDir() string {
	return filepath.Join(os.TempDir(), TempDirName, PayloadTempSubDir)
}

// ensurePayloadTempDir creates the payload temp directory if it doesn't exist.
func ensurePayloadTempDir() (string, error) {
	dir := getPayloadTempDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("create payload temp dir: %w", err)
	}
	return dir, nil
}

// CleanupExtractedPayload removes the cached extracted payload file.
// Call this when a new payload file is selected or when the app closes.
func (p *PayloadService) CleanupExtractedPayload() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.cachedExtractedPayload != "" {
		if err := os.Remove(p.cachedExtractedPayload); err != nil {
			fmt.Printf("Warning: failed to remove cached payload: %v\n", err)
		} else {
			fmt.Printf("Cleaned up cached payload: %s\n", p.cachedExtractedPayload)
		}
		p.cachedExtractedPayload = ""
		p.cachedZipPath = ""
	}
}

// CleanupAllPayloadTemp removes all temp files in the payload temp directory.
// Call this on app shutdown.
func CleanupAllPayloadTemp() {
	tempDir := getPayloadTempDir()
	if err := os.RemoveAll(tempDir); err != nil {
		fmt.Printf("Warning: failed to cleanup payload temp dir: %v\n", err)
	} else {
		fmt.Printf("Cleaned up payload temp directory: %s\n", tempDir)
	}
}

// ExtractPayloadResult represents the result of an extraction operation.
type ExtractPayloadResult struct {
	Success        bool     `json:"success"`
	OutputDir      string   `json:"outputDir"`
	ExtractedFiles []string `json:"extractedFiles"`
	Error          string   `json:"error,omitempty"`
}

// PayloadInfo contains information about a payload file.
type PayloadInfo struct {
	FilePath   string   `json:"filePath"`
	IsZip      bool     `json:"isZip"`
	Partitions []string `json:"partitions"`
}

// PartitionDetail contains detailed information about a partition.
type PartitionDetail struct {
	Name string `json:"name"`
	Size uint64 `json:"size"`
}

// ExtractPayload extracts partitions from a payload.bin file.
// If payloadPath is a ZIP file, it will first extract payload.bin from it.
func (p *PayloadService) ExtractPayload(payloadPath string, outputDir string, selectedPartitions []string) (*ExtractPayloadResult, error) {
	result := &ExtractPayloadResult{
		Success: false,
	}

	// Validate input file
	if _, err := os.Stat(payloadPath); os.IsNotExist(err) {
		result.Error = fmt.Sprintf("%v: %s", ErrFileNotFound, payloadPath)
		return result, nil
	}

	// Handle ZIP files - extract payload.bin first (uses cache)
	actualPayloadPath := payloadPath

	if strings.HasSuffix(strings.ToLower(payloadPath), ".zip") {
		extracted, err := p.extractPayloadFromZip(payloadPath)
		if err != nil {
			result.Error = fmt.Sprintf("extract payload.bin from ZIP: %v", err)
			return result, nil
		}
		actualPayloadPath = extracted
		// Note: Don't delete here - file is cached and will be cleaned up
		// via CleanupExtractedPayload or CleanupAllPayloadTemp
	}

	// Create output directory if it doesn't exist
	if outputDir == "" {
		now := time.Now()
		outputDir = filepath.Join(filepath.Dir(payloadPath),
			fmt.Sprintf("extracted_%d%02d%02d_%02d%02d%02d",
				now.Year(), now.Month(), now.Day(),
				now.Hour(), now.Minute(), now.Second()))
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		result.Error = fmt.Sprintf("create output directory: %v", err)
		return result, nil
	}

	// Use the payload package to extract
	payloadReader := payload.NewPayload(actualPayloadPath)
	if err := payloadReader.Open(); err != nil {
		result.Error = fmt.Sprintf("open payload: %v", err)
		return result, nil
	}

	if err := payloadReader.Init(); err != nil {
		result.Error = fmt.Sprintf("initialize payload: %v", err)
		return result, nil
	}

	// Set concurrency
	payloadReader.SetConcurrency(DefaultConcurrency)

	// Set up progress callback to emit Wails events
	if p.ctx != nil {
		payloadReader.SetProgressCallback(func(info payload.ProgressInfo) {
			wailsRuntime.EventsEmit(p.ctx, "payload:progress", map[string]interface{}{
				"partitionName": info.PartitionName,
				"current":       info.Current,
				"total":         info.Total,
				"completed":     info.Completed,
			})
		})
	}

	// Extract partitions
	var err error
	if len(selectedPartitions) > 0 {
		err = payloadReader.ExtractSelected(outputDir, selectedPartitions)
	} else {
		err = payloadReader.ExtractAll(outputDir)
	}

	if err != nil {
		result.Error = fmt.Sprintf("%v: %v", ErrExtractionFailed, err)
		return result, nil
	}

	// List extracted files
	files, _ := filepath.Glob(filepath.Join(outputDir, "*.img"))
	for _, f := range files {
		result.ExtractedFiles = append(result.ExtractedFiles, filepath.Base(f))
	}

	result.Success = true
	result.OutputDir = outputDir

	return result, nil
}

// ListPartitions lists available partitions in a payload.bin file.
func (p *PayloadService) ListPartitions(payloadPath string) ([]string, error) {
	// Validate input file
	if _, err := os.Stat(payloadPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("%w: %s", ErrFileNotFound, payloadPath)
	}

	// Handle ZIP files (uses cache)
	actualPayloadPath := payloadPath

	if strings.HasSuffix(strings.ToLower(payloadPath), ".zip") {
		extracted, err := p.extractPayloadFromZip(payloadPath)
		if err != nil {
			return nil, fmt.Errorf("extract payload.bin from ZIP: %w", err)
		}
		actualPayloadPath = extracted
		// Note: cached, cleaned up via CleanupExtractedPayload
	}

	// Use payload package to list partitions
	payloadReader := payload.NewPayload(actualPayloadPath)
	if err := payloadReader.Open(); err != nil {
		return nil, fmt.Errorf("open payload: %w", err)
	}

	if err := payloadReader.Init(); err != nil {
		return nil, fmt.Errorf("initialize payload: %w", err)
	}

	// Extract partition names from the manifest
	var partitions []string
	for _, partition := range payloadReader.GetManifest().Partitions {
		partitions = append(partitions, partition.GetPartitionName())
	}

	return partitions, nil
}

// ListPartitionsWithDetails lists available partitions with size info.
func (p *PayloadService) ListPartitionsWithDetails(payloadPath string) ([]PartitionDetail, error) {
	// Validate input file
	if _, err := os.Stat(payloadPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("%w: %s", ErrFileNotFound, payloadPath)
	}

	// Handle ZIP files (uses cache)
	actualPayloadPath := payloadPath

	if strings.HasSuffix(strings.ToLower(payloadPath), ".zip") {
		extracted, err := p.extractPayloadFromZip(payloadPath)
		if err != nil {
			return nil, fmt.Errorf("extract payload.bin from ZIP: %w", err)
		}
		actualPayloadPath = extracted
		// Note: cached, cleaned up via CleanupExtractedPayload
	}

	// Use payload package to list partitions
	payloadReader := payload.NewPayload(actualPayloadPath)
	if err := payloadReader.Open(); err != nil {
		return nil, fmt.Errorf("open payload: %w", err)
	}

	if err := payloadReader.Init(); err != nil {
		return nil, fmt.Errorf("initialize payload: %w", err)
	}

	// Extract partition details from the manifest
	var partitions []PartitionDetail
	for _, partition := range payloadReader.GetManifest().Partitions {
		info := partition.GetNewPartitionInfo()
		size := uint64(0)
		if info != nil && info.Size != nil {
			size = *info.Size
		}
		partitions = append(partitions, PartitionDetail{
			Name: partition.GetPartitionName(),
			Size: size,
		})
	}

	return partitions, nil
}

// extractPayloadFromZip extracts payload.bin from a ZIP file to a temp location.
// Uses caching to avoid re-extracting the same ZIP file.
func (p *PayloadService) extractPayloadFromZip(zipPath string) (string, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	// Check if we already extracted this ZIP file
	if p.cachedZipPath == zipPath && p.cachedExtractedPayload != "" {
		// Verify the cached file still exists
		if _, err := os.Stat(p.cachedExtractedPayload); err == nil {
			return p.cachedExtractedPayload, nil
		}
		// Cached file is gone, need to re-extract
		p.cachedExtractedPayload = ""
		p.cachedZipPath = ""
	}

	// Clean up previous cached file if switching to a different ZIP
	if p.cachedExtractedPayload != "" && p.cachedZipPath != zipPath {
		os.Remove(p.cachedExtractedPayload)
		p.cachedExtractedPayload = ""
		p.cachedZipPath = ""
	}

	zipReader, err := zip.OpenReader(zipPath)
	if err != nil {
		return "", fmt.Errorf("not a valid zip archive: %w", err)
	}
	defer zipReader.Close()

	for _, file := range zipReader.Reader.File {
		if file.Name == "payload.bin" && file.UncompressedSize64 > 0 {
			zippedFile, err := file.Open()
			if err != nil {
				return "", fmt.Errorf("read zipped file: %w", err)
			}

			// Ensure payload temp directory exists
			tempDir, err := ensurePayloadTempDir()
			if err != nil {
				zippedFile.Close()
				return "", err
			}

			// Create temp file in our dedicated temp folder
			tempfile, err := os.CreateTemp(tempDir, "payload_*.bin")
			if err != nil {
				zippedFile.Close()
				return "", fmt.Errorf("create temp file: %w", err)
			}

			// Copy content
			_, copyErr := io.Copy(tempfile, zippedFile)

			// Close both files
			zippedFile.Close()
			tempfile.Close()

			if copyErr != nil {
				os.Remove(tempfile.Name())
				return "", fmt.Errorf("extract payload.bin: %w", copyErr)
			}

			// Cache the extraction result
			p.cachedZipPath = zipPath
			p.cachedExtractedPayload = tempfile.Name()

			return tempfile.Name(), nil
		}
	}

	return "", fmt.Errorf("payload.bin not found in ZIP archive")
}
