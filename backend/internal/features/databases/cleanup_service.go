package databases

import (
	"log/slog"
	"time"
)

const (
	TrashRetentionDays   = 30
	CleanupCheckInterval = 1 * time.Hour
)

type CleanupService struct {
	databaseService *DatabaseService
	logger          *slog.Logger
}

func (s *CleanupService) Run() {
	s.logger.Info("Starting database cleanup service",
		"retention_days", TrashRetentionDays,
		"check_interval", CleanupCheckInterval,
	)

	s.runCleanup()

	ticker := time.NewTicker(CleanupCheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		s.runCleanup()
	}
}

func (s *CleanupService) runCleanup() {
	deletedCount, err := s.databaseService.CleanupOldDeletedDatabases(TrashRetentionDays)
	if err != nil {
		s.logger.Error("Failed to cleanup old deleted databases", "error", err)
		return
	}

	if deletedCount > 0 {
		s.logger.Info("Cleaned up old deleted databases",
			"deleted_count", deletedCount,
			"retention_days", TrashRetentionDays,
		)
	}
}



