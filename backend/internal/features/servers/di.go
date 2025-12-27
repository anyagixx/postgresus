package servers

import (
	"postgresus-backend/internal/util/encryption"
	"postgresus-backend/internal/util/logger"
)

var serverRepository = &ServerRepository{}
var serverService = &ServerService{
	serverRepository,
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
