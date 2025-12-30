package usecases_mariadb

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/klauspost/compress/zstd"

	backup_encryption "postgresus-backend/internal/features/backups/backups/encryption"
	backups_config "postgresus-backend/internal/features/backups/config"
	usecases_common "postgresus-backend/internal/features/backups/backups/usecases/common"
	"postgresus-backend/internal/features/databases"
	encryption_secrets "postgresus-backend/internal/features/encryption/secrets"
	"postgresus-backend/internal/features/storages"
	util_encryption "postgresus-backend/internal/util/encryption"
)

type ValidateMariadbBackupUsecase struct {
	logger           *slog.Logger
	secretKeyService *encryption_secrets.SecretKeyService
	fieldEncryptor   util_encryption.FieldEncryptor
}

type ValidationResult struct {
	IsValid     bool
	Error       *string
	Details     *string
	ValidatedAt time.Time
}

func (uc *ValidateMariadbBackupUsecase) Execute(
	ctx context.Context,
	backup *usecases_common.BackupInfo,
	database *databases.Database,
	storage *storages.Storage,
) (*ValidationResult, error) {
	uc.logger.Info(
		"Validating MariaDB backup integrity (streaming)",
		"backupId", backup.ID,
		"databaseId", database.ID,
	)

	mdb := database.Mariadb
	if mdb == nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("mariadb configuration is missing"),
		}, nil
	}

	// Get backup data from storage (streaming, no temp file)
	rawReader, err := storage.GetFile(uc.fieldEncryptor, backup.ID)
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to get backup file from storage: %v", err)),
		}, nil
	}
	defer func() {
		if err := rawReader.Close(); err != nil {
			uc.logger.Error("Failed to close backup reader", "error", err)
		}
	}()

	// Setup decryption if needed
	var backupReader io.Reader = rawReader
	if backup.Encryption == backups_config.BackupEncryptionEncrypted {
		decryptReader, err := uc.setupDecryption(rawReader, backup)
		if err != nil {
			return &ValidationResult{
				IsValid: false,
				Error:   stringPtr(fmt.Sprintf("failed to setup decryption: %v", err)),
			}, nil
		}
		backupReader = decryptReader
	}

	// Decompress zstd stream
	zstdReader, err := zstd.NewReader(backupReader)
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to create zstd reader: %v", err)),
			Details: stringPtr("Backup file may be corrupted or not compressed with zstd"),
		}, nil
	}
	defer zstdReader.Close()

	// Read first 64KB for syntax validation (streaming!)
	buffer := make([]byte, 64*1024)
	n, err := zstdReader.Read(buffer)
	if err != nil && err != io.EOF {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to read backup file: %v", err)),
			Details: stringPtr("Backup file appears to be corrupted"),
		}, nil
	}

	if n == 0 {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("backup file is empty"),
		}, nil
	}

	// Check for key SQL commands
	content := string(buffer[:n])
	hasCreateTable := strings.Contains(content, "CREATE TABLE")
	hasInsert := strings.Contains(content, "INSERT")
	hasUse := strings.Contains(content, "USE ") || strings.Contains(content, "/*!40101")

	if !hasCreateTable && !hasInsert && !hasUse {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("backup file does not contain valid SQL statements"),
			Details: stringPtr("File may be corrupted or in wrong format"),
		}, nil
	}

	details := fmt.Sprintf(
		"Backup file is valid (streaming validation). Contains CREATE TABLE: %v, INSERT: %v",
		hasCreateTable,
		hasInsert,
	)

	return &ValidationResult{
		IsValid:     true,
		Details:     stringPtr(details),
		ValidatedAt: time.Now().UTC(),
	}, nil
}

func (uc *ValidateMariadbBackupUsecase) setupDecryption(
	reader io.Reader,
	backup *usecases_common.BackupInfo,
) (io.Reader, error) {
	if backup.EncryptionSalt == nil || backup.EncryptionIV == nil {
		return nil, fmt.Errorf("backup is encrypted but missing encryption metadata")
	}

	masterKey, err := uc.secretKeyService.GetSecretKey()
	if err != nil {
		return nil, fmt.Errorf("failed to get master key for decryption: %w", err)
	}

	salt, err := base64.StdEncoding.DecodeString(*backup.EncryptionSalt)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption salt: %w", err)
	}

	iv, err := base64.StdEncoding.DecodeString(*backup.EncryptionIV)
	if err != nil {
		return nil, fmt.Errorf("failed to decode encryption IV: %w", err)
	}

	decryptReader, err := backup_encryption.NewDecryptionReader(
		reader,
		masterKey,
		backup.ID,
		salt,
		iv,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create decryption reader: %w", err)
	}

	uc.logger.Info("Using decryption for encrypted backup", "backupId", backup.ID)
	return decryptReader, nil
}

func stringPtr(s string) *string {
	return &s
}
