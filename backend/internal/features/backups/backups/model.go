package backups

import (
	backups_config "postgresus-backend/internal/features/backups/config"
	"time"

	"github.com/google/uuid"
)

type Backup struct {
	ID uuid.UUID `json:"id" gorm:"column:id;type:uuid;primaryKey"`

	DatabaseID uuid.UUID `json:"databaseId" gorm:"column:database_id;type:uuid;not null"`
	StorageID  uuid.UUID `json:"storageId"  gorm:"column:storage_id;type:uuid;not null"`

	Status      BackupStatus `json:"status"      gorm:"column:status;not null"`
	FailMessage *string      `json:"failMessage" gorm:"column:fail_message"`

	BackupSizeMb float64 `json:"backupSizeMb" gorm:"column:backup_size_mb;default:0"`

	BackupDurationMs int64 `json:"backupDurationMs" gorm:"column:backup_duration_ms;default:0"`

	EncryptionSalt *string                         `json:"-"          gorm:"column:encryption_salt"`
	EncryptionIV   *string                         `json:"-"          gorm:"column:encryption_iv"`
	Encryption     backups_config.BackupEncryption `json:"encryption" gorm:"column:encryption;type:text;not null;default:'NONE'"`

	ValidationStatus *ValidationStatus `json:"validationStatus" gorm:"column:validation_status;type:text"`
	ValidatedAt      *time.Time       `json:"validatedAt"      gorm:"column:validated_at"`
	ValidationError  *string           `json:"validationError"  gorm:"column:validation_error;type:text"`
	ValidationDetails *string          `json:"validationDetails" gorm:"column:validation_details;type:text"`

	CreatedAt time.Time `json:"createdAt" gorm:"column:created_at"`
}
