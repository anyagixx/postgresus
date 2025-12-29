package usecases_mongodb

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"postgresus-backend/internal/config"
	backup_encryption "postgresus-backend/internal/features/backups/backups/encryption"
	backups_config "postgresus-backend/internal/features/backups/config"
	usecases_common "postgresus-backend/internal/features/backups/backups/usecases/common"
	"postgresus-backend/internal/features/databases"
	encryption_secrets "postgresus-backend/internal/features/encryption/secrets"
	"postgresus-backend/internal/features/storages"
	util_encryption "postgresus-backend/internal/util/encryption"
	files_utils "postgresus-backend/internal/util/files"
	"postgresus-backend/internal/util/tools"

	"github.com/google/uuid"
)

type ValidateMongodbBackupUsecase struct {
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

func (uc *ValidateMongodbBackupUsecase) Execute(
	ctx context.Context,
	backup *usecases_common.BackupInfo,
	database *databases.Database,
	storage *storages.Storage,
) (*ValidationResult, error) {
	uc.logger.Info(
		"Validating MongoDB backup integrity",
		"backupId", backup.ID,
		"databaseId", database.ID,
	)

	mongo := database.Mongodb
	if mongo == nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("mongodb configuration is missing"),
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

	// Use mongorestore --dryRun to validate archive
	mongorestoreBin := tools.GetMongodbExecutable(
		tools.MongodbExecutableMongorestore,
		config.GetEnv().EnvMode,
		config.GetEnv().MongodbInstallDir,
	)

	// Run mongorestore --dryRun to validate the archive
	cmd := exec.CommandContext(
		ctx,
		mongorestoreBin,
		"--archive="+tempFile,
		"--gzip",
		"--dryRun",
		"--quiet",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		errorMsg := string(output)
		if errorMsg == "" {
			errorMsg = err.Error()
		}
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("mongorestore validation failed: %s", errorMsg)),
			Details: stringPtr("Backup archive appears to be corrupted or invalid"),
		}, nil
	}

	return &ValidationResult{
		IsValid:     true,
		Details:     stringPtr("MongoDB backup archive is valid"),
		ValidatedAt: time.Now().UTC(),
	}, nil
}

// downloadBackupToTempFile downloads backup data from storage to a temporary file
func (uc *ValidateMongodbBackupUsecase) downloadBackupToTempFile(
	ctx context.Context,
	backup *usecases_common.BackupInfo,
	storage *storages.Storage,
) (string, func(), error) {
	err := files_utils.EnsureDirectories([]string{
		config.GetEnv().TempFolder,
	})
	if err != nil {
		return "", nil, fmt.Errorf("failed to ensure directories: %w", err)
	}

	tempDir, err := os.MkdirTemp(config.GetEnv().TempFolder, "validate_"+uuid.New().String())
	if err != nil {
		return "", nil, fmt.Errorf("failed to create temporary directory: %w", err)
	}

	cleanupFunc := func() {
		_ = os.RemoveAll(tempDir)
	}

	tempBackupFile := filepath.Join(tempDir, "backup.archive.gz")

	uc.logger.Info(
		"Downloading backup file from storage to temporary file",
		"backupId", backup.ID,
		"tempFile", tempBackupFile,
		"encrypted", backup.Encryption == backups_config.BackupEncryptionEncrypted,
	)

	fieldEncryptor := util_encryption.GetFieldEncryptor()
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
		decryptReader, err := uc.setupDecryption(rawReader, backup)
		if err != nil {
			cleanupFunc()
			return "", nil, fmt.Errorf("failed to setup decryption: %w", err)
		}
		backupReader = decryptReader
	}

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

	_, err = io.Copy(tempFile, backupReader)
	if err != nil {
		cleanupFunc()
		return "", nil, fmt.Errorf("failed to write backup to temporary file: %w", err)
	}

	uc.logger.Info("Backup file written to temporary location", "tempFile", tempBackupFile)
	return tempBackupFile, cleanupFunc, nil
}

func (uc *ValidateMongodbBackupUsecase) setupDecryption(
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

