package system_healthcheck

import (
	"errors"
	"postgresus-backend/internal/features/backups/backups"
	"postgresus-backend/internal/features/disk"
	"postgresus-backend/internal/storage"
)

type HealthcheckService struct {
	diskService             *disk.DiskService
	backupBackgroundService *backups.BackupBackgroundService
}

func (s *HealthcheckService) IsHealthy() error {
	diskUsage, err := s.diskService.GetDiskUsage()
	if err != nil {
		return errors.New("cannot get disk usage")
	}

	if float64(diskUsage.UsedSpaceBytes) >= float64(diskUsage.TotalSpaceBytes)*0.95 {
		return errors.New("more than 95% of the disk is used")
	}

	db := storage.GetDb()
	err = db.Raw("SELECT 1").Error

	if err != nil {
		return errors.New("cannot connect to the database")
	}

	if !s.backupBackgroundService.IsBackupsWorkerRunning() {
		return errors.New("backups are not running for more than 5 minutes")
	}

	return nil
}
