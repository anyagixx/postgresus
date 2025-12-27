package servers

import (
	"postgresus-backend/internal/features/databases"
	"postgresus-backend/internal/util/encryption"
	"postgresus-backend/internal/util/logger"
)

var serverRepository = &ServerRepository{}
var databaseRepository = &databases.DatabaseRepository{}
var serverService = &ServerService{
	serverRepository,
	databaseRepository,
	logger.GetLogger(),
	encryption.GetFieldEncryptor(),
}
var serverController = &ServerController{
	serverService,
}

func GetServerService() *ServerService {
	return serverService
}

func GetServerController() *ServerController {
	return serverController
}
