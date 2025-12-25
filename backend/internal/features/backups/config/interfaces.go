package backups_config

import "github.com/google/uuid"

type BackupConfigStorageChangeListener interface {
	OnBeforeBackupsStorageChange(dbID uuid.UUID) error
}
