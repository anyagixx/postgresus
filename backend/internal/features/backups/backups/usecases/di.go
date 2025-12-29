package usecases

import (
	usecases_mariadb "postgresus-backend/internal/features/backups/backups/usecases/mariadb"
	usecases_mongodb "postgresus-backend/internal/features/backups/backups/usecases/mongodb"
	usecases_mysql "postgresus-backend/internal/features/backups/backups/usecases/mysql"
	usecases_postgresql "postgresus-backend/internal/features/backups/backups/usecases/postgresql"
)

var createBackupUsecase = &CreateBackupUsecase{
	usecases_postgresql.GetCreatePostgresqlBackupUsecase(),
	usecases_mysql.GetCreateMysqlBackupUsecase(),
	usecases_mariadb.GetCreateMariadbBackupUsecase(),
	usecases_mongodb.GetCreateMongodbBackupUsecase(),
}

var validateBackupUsecase = &ValidateBackupUsecase{
	usecases_postgresql.GetValidatePostgresqlBackupUsecase(),
	usecases_mysql.GetValidateMysqlBackupUsecase(),
	usecases_mariadb.GetValidateMariadbBackupUsecase(),
	usecases_mongodb.GetValidateMongodbBackupUsecase(),
}

func GetCreateBackupUsecase() *CreateBackupUsecase {
	return createBackupUsecase
}

func GetValidateBackupUsecase() *ValidateBackupUsecase {
	return validateBackupUsecase
}
