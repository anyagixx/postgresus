package usecases_mysql

import (
	"postgresus-backend/internal/features/encryption/secrets"
	"postgresus-backend/internal/util/encryption"
	"postgresus-backend/internal/util/logger"
)

var createMysqlBackupUsecase = &CreateMysqlBackupUsecase{
	logger.GetLogger(),
	secrets.GetSecretKeyService(),
	encryption.GetFieldEncryptor(),
}

var validateMysqlBackupUsecase = &ValidateMysqlBackupUsecase{
	logger.GetLogger(),
	secrets.GetSecretKeyService(),
	encryption.GetFieldEncryptor(),
}

func GetCreateMysqlBackupUsecase() *CreateMysqlBackupUsecase {
	return createMysqlBackupUsecase
}

func GetValidateMysqlBackupUsecase() *ValidateMysqlBackupUsecase {
	return validateMysqlBackupUsecase
}
