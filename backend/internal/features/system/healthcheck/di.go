package system_healthcheck

import (
	"postgresus-backend/internal/features/backups/backups"
	"postgresus-backend/internal/features/disk"
)

var healthcheckService = &HealthcheckService{
	disk.GetDiskService(),
	backups.GetBackupBackgroundService(),
}
var healthcheckController = &HealthcheckController{
	healthcheckService,
}

func GetHealthcheckController() *HealthcheckController {
	return healthcheckController
}
