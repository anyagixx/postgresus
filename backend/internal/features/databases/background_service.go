package databases

import (
	"log/slog"
	"postgresus-backend/internal/config"
	users_models "postgresus-backend/internal/features/users/models"
	"time"
)

type DatabaseCleanupBackgroundService struct {
	databaseService *DatabaseService
	logger          *slog.Logger
}

func (s *DatabaseCleanupBackgroundService) Run() {
	// Run cleanup every hour
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// Run first cleanup immediately
	s.cleanOldDeletedDatabases()

	for range ticker.C {
		if config.IsShouldShutdown() {
			break
		}

		s.cleanOldDeletedDatabases()
	}
}

func (s *DatabaseCleanupBackgroundService) cleanOldDeletedDatabases() {
	// Find databases deleted more than 30 days ago
	cutoffDate := time.Now().UTC().Add(-30 * 24 * time.Hour)

	// Get all databases (including deleted ones) to find old deleted ones
	allDatabases, err := s.databaseService.dbRepository.GetAllDatabasesUnscoped()
	if err != nil {
		s.logger.Error("Failed to get all databases for cleanup", "error", err)
		return
	}

	// Filter databases deleted more than 30 days ago
	var databasesToDelete []*Database
	for _, db := range allDatabases {
		if !db.DeletedAt.Time.IsZero() && db.DeletedAt.Time.Before(cutoffDate) {
			databasesToDelete = append(databasesToDelete, db)
		}
	}

	if len(databasesToDelete) == 0 {
		return
	}

	s.logger.Info("Found databases to permanently delete", "count", len(databasesToDelete))

	// Permanently delete each database
	// We need to call listeners to delete backups, but we can't use service method
	// because it requires user. Instead, we'll call repository and handle backups separately
	for _, db := range databasesToDelete {
		if db.WorkspaceID == nil {
			s.logger.Warn("Skipping database without workspace", "database_id", db.ID)
			continue
		}

		// Call listeners to delete backups before permanent delete
		for _, listener := range s.databaseService.dbRemoveListener {
			if err := listener.OnBeforeDatabasePermanentRemove(db.ID); err != nil {
				s.logger.Error("Failed to delete backups before permanent delete", "database_id", db.ID, "error", err)
				// Continue anyway - we'll try to delete the database
			}
		}

		// Now permanently delete the database
		err := s.databaseService.dbRepository.PermanentDelete(db.ID)
		if err != nil {
			s.logger.Error("Failed to permanently delete database", "database_id", db.ID, "error", err)
			continue
		}

		s.logger.Info("Permanently deleted old database", "database_id", db.ID, "database_name", db.Name, "deleted_at", db.DeletedAt.Time)
	}
}

