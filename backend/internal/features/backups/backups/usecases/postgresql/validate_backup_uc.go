package usecases_postgresql

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"postgresus-backend/internal/config"
	backups_config "postgresus-backend/internal/features/backups/config"
	"postgresus-backend/internal/features/backups/backups"
	"postgresus-backend/internal/features/databases"
	pgtypes "postgresus-backend/internal/features/databases/databases/postgresql"
	encryption_secrets "postgresus-backend/internal/features/encryption/secrets"
	"postgresus-backend/internal/features/storages"
	"postgresus-backend/internal/util/encryption"
	files_utils "postgresus-backend/internal/util/files"
	"postgresus-backend/internal/util/tools"

	"github.com/google/uuid"
)

type ValidatePostgresqlBackupUsecase struct {
	logger           *slog.Logger
	secretKeyService *encryption_secrets.SecretKeyService
	fieldEncryptor   encryption.FieldEncryptor
}

type ValidationResult struct {
	IsValid      bool
	Error        *string
	Details      *string
	ValidatedAt  time.Time
}

func (uc *ValidatePostgresqlBackupUsecase) Execute(
	ctx context.Context,
	backup *backups.Backup,
	database *databases.Database,
	storage *storages.Storage,
) (*ValidationResult, error) {
	uc.logger.Info(
		"Validating PostgreSQL backup integrity",
		"backupId", backup.ID,
		"databaseId", database.ID,
	)

	pg := database.Postgresql
	if pg == nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("postgresql configuration is missing"),
		}, nil
	}

	// Download backup to temporary file
	tempFile, cleanupFunc, err := uc.downloadBackupToTempFile(ctx, backup, storage)
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to download backup: %v", err)),
		}, nil
	}
	defer cleanupFunc()

	// Use pg_restore --list to validate backup structure
	pgRestoreBin := tools.GetPostgresqlExecutable(
		pg.Version,
		"pg_restore",
		config.GetEnv().EnvMode,
		config.GetEnv().PostgresesInstallDir,
	)

	cmd := exec.CommandContext(ctx, pgRestoreBin, "--list", tempFile)
	output, err := cmd.CombinedOutput()

	if err != nil {
		errorMsg := string(output)
		if errorMsg == "" {
			errorMsg = err.Error()
		}
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("pg_restore validation failed: %s", errorMsg)),
			Details:  stringPtr("Backup file appears to be corrupted or invalid"),
		}, nil
	}

	// Check that output contains at least one entry (backup is not empty)
	outputStr := string(output)
	if strings.TrimSpace(outputStr) == "" {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("backup file is empty or contains no data"),
		}, nil
	}

	// Check for key elements in TOC
	hasTables := strings.Contains(outputStr, "TABLE")
	hasData := strings.Contains(outputStr, "TABLE DATA") || strings.Contains(outputStr, "BLOBS")

	details := fmt.Sprintf(
		"Backup structure is valid. Contains tables: %v, data: %v",
		hasTables,
		hasData,
	)

	return &ValidationResult{
		IsValid:     true,
		Details:     stringPtr(details),
		ValidatedAt: time.Now().UTC(),
	}, nil
}

// downloadBackupToTempFile downloads backup data from storage to a temporary file
func (uc *ValidatePostgresqlBackupUsecase) downloadBackupToTempFile(
	ctx context.Context,
	backup *backups.Backup,
	storage *storages.Storage,
) (string, func(), error) {
	err := files_utils.EnsureDirectories([]string{
		config.GetEnv().TempFolder,
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to ensure directories: %w", err)
	}

	// Create temporary directory for backup data
	tempDir, err := os.MkdirTemp(config.GetEnv().TempFolder, "validate_"+uuid.New().String())
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temporary directory: %w", err)
	}

	cleanupFunc := func() {
		_ = os.RemoveAll(tempDir)
	}

	tempBackupFile := filepath.Join(tempDir, "backup.dump")

	// Get backup data from storage
	uc.logger.Info(
		"Downloading backup file from storage to temporary file",
		"backupId", backup.ID,
		"tempFile", tempBackupFile,
		"encrypted", backup.Encryption == backups_config.BackupEncryptionEncrypted,
	)
	fieldEncryptor := encryption.GetFieldEncryptor()
	rawReader, err := storage.GetFile(fieldEncryptor, backup.ID)
	if err != nil {
		cleanupFunc()
		return "", nil, fmt.Errorf("failed to get backup file from storage: %w", err)
	}
	defer func() {
		if err := rawReader.Close(); err != nil {
			uc.logger.Error("Failed to close backup reader", "error", err)
		}
	}()

	// Create a reader that handles decryption if needed
	var backupReader io.Reader = rawReader
	if backup.Encryption == backups_config.BackupEncryptionEncrypted {
		// Validate encryption metadata
		if backup.EncryptionSalt == nil || backup.EncryptionIV == nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("backup is encrypted but missing encryption metadata")
		}

		// Get master key
		masterKey, err := uc.secretKeyService.GetSecretKey()
		if err != nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("failed to get master key for decryption: %w", err)
		}

		// Decode salt and IV from base64
		salt, err := base64.StdEncoding.DecodeString(*backup.EncryptionSalt)
		if err != nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("failed to decode encryption salt: %w", err)
		}

		iv, err := base64.StdEncoding.DecodeString(*backup.EncryptionIV)
		if err != nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("failed to decode encryption IV: %w", err)
		}

		// Create decryption reader
		decryptReader, err := encryption.NewDecryptionReader(
			rawReader,
			masterKey,
			backup.ID,
			salt,
			iv,
		)
		if err != nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("failed to create decryption reader: %w", err)
		}

		backupReader = decryptReader
		uc.logger.Info("Using decryption for encrypted backup", "backupId", backup.ID)
	}

	// Create temporary backup file
	tempFile, err := os.Create(tempBackupFile)
	if err != nil {
		cleanupFunc()
		return "", nil, fmt.Errorf("failed to create temporary backup file: %w", err)
	}
	defer func() {
		if err := tempFile.Close(); err != nil {
			uc.logger.Error("Failed to close temporary file", "error", err)
		}
	}()

	// Copy backup data to temporary file
	_, err = io.Copy(tempFile, backupReader)
	if err != nil {
		cleanupFunc()
		return "", nil, fmt.Errorf("failed to write backup to temporary file: %w", err)
	}

	uc.logger.Info("Backup file written to temporary location", "tempFile", tempBackupFile)
	return tempBackupFile, cleanupFunc, nil
}

func stringPtr(s string) *string {
	return &s
}

