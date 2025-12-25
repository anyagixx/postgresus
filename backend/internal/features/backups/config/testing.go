package backups_config

import (
	"postgresus-backend/internal/features/intervals"
	"postgresus-backend/internal/features/storages"
	"postgresus-backend/internal/util/period"

	"github.com/google/uuid"
)

func EnableBackupsForTestDatabase(
	databaseID uuid.UUID,
	storage *storages.Storage,
) *BackupConfig {
	timeOfDay := "16:00"

	backupConfig := &BackupConfig{
		DatabaseID:       databaseID,
		IsBackupsEnabled: true,
		StorePeriod:      period.PeriodDay,
		BackupInterval: &intervals.Interval{
			Interval:  intervals.IntervalDaily,
			TimeOfDay: &timeOfDay,
		},
		StorageID: &storage.ID,
		Storage:   storage,
		SendNotificationsOn: []BackupNotificationType{
			NotificationBackupFailed,
			NotificationBackupSuccess,
		},
		CpuCount: 1,
	}

	backupConfig, err := GetBackupConfigService().SaveBackupConfig(backupConfig)
	if err != nil {
		panic(err)
	}

	return backupConfig
}
