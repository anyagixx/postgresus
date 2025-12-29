package common

import (
	"time"

	backups_config "postgresus-backend/internal/features/backups/config"
	"github.com/google/uuid"
)

type BackupMetadata struct {
	EncryptionSalt *string
	EncryptionIV   *string
	Encryption     backups_config.BackupEncryption
}

type ValidationResult struct {
	IsValid     bool
	Error       *string
	Details     *string
	ValidatedAt time.Time
}

type BackupInfo struct {
	ID            uuid.UUID
	DatabaseID   uuid.UUID
	StorageID    uuid.UUID
	Encryption    backups_config.BackupEncryption
	EncryptionSalt *string
	EncryptionIV   *string
}
