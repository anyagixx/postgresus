package usecases_mongodb

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"time"

	"postgresus-backend/internal/config"
	backup_encryption "postgresus-backend/internal/features/backups/backups/encryption"
	backups_config "postgresus-backend/internal/features/backups/config"
	usecases_common "postgresus-backend/internal/features/backups/backups/usecases/common"
	"postgresus-backend/internal/features/databases"
	encryption_secrets "postgresus-backend/internal/features/encryption/secrets"
	"postgresus-backend/internal/features/storages"
	util_encryption "postgresus-backend/internal/util/encryption"
	"postgresus-backend/internal/util/tools"
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

	// Decrypt password for URI construction
	decryptedPassword, err := uc.fieldEncryptor.Decrypt(database.ID, mongo.Password)
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to decrypt database password: %v", err)),
		}, nil
	}

	// Build MongoDB URI (required for mongorestore --dryRun)
	uri := mongo.BuildMongodumpURI(decryptedPassword)

	// Get backup data from storage
	fieldEncryptor := util_encryption.GetFieldEncryptor()
	rawReader, err := storage.GetFile(fieldEncryptor, backup.ID)
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

	// Create a reader that handles decryption if needed
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

	// Use mongorestore --dryRun to validate archive
	mongorestoreBin := tools.GetMongodbExecutable(
		tools.MongodbExecutableMongorestore,
		config.GetEnv().EnvMode,
		config.GetEnv().MongodbInstallDir,
	)

	// Build command arguments with URI (required for --dryRun)
	args := []string{
		"--uri=" + uri,
		"--archive",
		"--gzip",
		"--dryRun",
		"--quiet",
	}

	// Create safe args for logging (mask password in URI)
	safeArgs := make([]string, len(args))
	for i, arg := range args {
		if len(arg) > 6 && arg[:6] == "--uri=" {
			safeArgs[i] = "--uri=mongodb://***:***@***"
		} else {
			safeArgs[i] = arg
		}
	}
	uc.logger.Info(
		"Executing MongoDB validation command",
		"command", mongorestoreBin,
		"args", safeArgs,
	)

	// Run mongorestore --dryRun with stdin input (like restore does)
	cmd := exec.CommandContext(
		ctx,
		mongorestoreBin,
		args...,
	)

	cmd.Stdin = backupReader
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "LC_ALL=C.UTF-8", "LANG=C.UTF-8")

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to create stderr pipe: %v", err)),
		}, nil
	}

	stderrCh := make(chan []byte, 1)
	go func() {
		output, _ := io.ReadAll(stderrPipe)
		stderrCh <- output
	}()

	if err = cmd.Start(); err != nil {
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr(fmt.Sprintf("failed to start mongorestore: %v", err)),
		}, nil
	}

	waitErr := cmd.Wait()
	stderrOutput := <-stderrCh

	if waitErr != nil {
		errorMsg := string(stderrOutput)
		if errorMsg == "" {
			errorMsg = waitErr.Error()
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

