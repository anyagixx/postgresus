package usecases

import (
	"context"

	usecases_common "postgresus-backend/internal/features/backups/backups/usecases/common"
	usecases_mariadb "postgresus-backend/internal/features/backups/backups/usecases/mariadb"
	usecases_mongodb "postgresus-backend/internal/features/backups/backups/usecases/mongodb"
	usecases_mysql "postgresus-backend/internal/features/backups/backups/usecases/mysql"
	usecases_postgresql "postgresus-backend/internal/features/backups/backups/usecases/postgresql"
	"postgresus-backend/internal/features/databases"
	"postgresus-backend/internal/features/storages"
)

type ValidationResult = usecases_common.ValidationResult
type BackupInfo = usecases_common.BackupInfo

type ValidateBackupUsecase struct {
	ValidatePostgresqlBackupUsecase *usecases_postgresql.ValidatePostgresqlBackupUsecase
	ValidateMysqlBackupUsecase      *usecases_mysql.ValidateMysqlBackupUsecase
	ValidateMariadbBackupUsecase    *usecases_mariadb.ValidateMariadbBackupUsecase
	ValidateMongodbBackupUsecase     *usecases_mongodb.ValidateMongodbBackupUsecase
}

func (uc *ValidateBackupUsecase) Execute(
	ctx context.Context,
	backup *BackupInfo,
	database *databases.Database,
	storage *storages.Storage,
) (*ValidationResult, error) {
	switch database.Type {
	case databases.DatabaseTypePostgres:
		result, err := uc.ValidatePostgresqlBackupUsecase.Execute(ctx, backup, database, storage)
		if err != nil {
			return nil, err
		}
		return convertPostgresqlResult(result), nil

	case databases.DatabaseTypeMysql:
		result, err := uc.ValidateMysqlBackupUsecase.Execute(ctx, backup, database, storage)
		if err != nil {
			return nil, err
		}
		return convertMysqlResult(result), nil

	case databases.DatabaseTypeMariadb:
		result, err := uc.ValidateMariadbBackupUsecase.Execute(ctx, backup, database, storage)
		if err != nil {
			return nil, err
		}
		return convertMariadbResult(result), nil

	case databases.DatabaseTypeMongodb:
		result, err := uc.ValidateMongodbBackupUsecase.Execute(ctx, backup, database, storage)
		if err != nil {
			return nil, err
		}
		return convertMongodbResult(result), nil

	default:
		return &ValidationResult{
			IsValid: false,
			Error:   stringPtr("database type not supported"),
		}, nil
	}
}

func convertPostgresqlResult(result *usecases_postgresql.ValidationResult) *ValidationResult {
	return &ValidationResult{
		IsValid:     result.IsValid,
		Error:       result.Error,
		Details:     result.Details,
		ValidatedAt: result.ValidatedAt,
	}
}

func convertMysqlResult(result *usecases_mysql.ValidationResult) *ValidationResult {
	return &ValidationResult{
		IsValid:     result.IsValid,
		Error:       result.Error,
		Details:     result.Details,
		ValidatedAt: result.ValidatedAt,
	}
}

func convertMariadbResult(result *usecases_mariadb.ValidationResult) *ValidationResult {
	return &ValidationResult{
		IsValid:     result.IsValid,
		Error:       result.Error,
		Details:     result.Details,
		ValidatedAt: result.ValidatedAt,
	}
}

func convertMongodbResult(result *usecases_mongodb.ValidationResult) *ValidationResult {
	return &ValidationResult{
		IsValid:     result.IsValid,
		Error:       result.Error,
		Details:     result.Details,
		ValidatedAt: result.ValidatedAt,
	}
}

func stringPtr(s string) *string {
	return &s
}

