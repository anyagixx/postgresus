// +build !circular

package databases

import (
	"postgresus-backend/internal/features/servers"
	"github.com/google/uuid"
)

// getServerServiceForBatchCreate is a helper function to get server service
// This file is separated to break circular dependency
func getServerServiceForBatchCreate(
	workspaceID uuid.UUID,
	name string,
	dbType string,
	host string,
	port int,
	username string,
	password string,
	isHttps bool,
) (*servers.Server, error) {
	serverService := servers.GetServerService()
	return serverService.GetOrCreateServerByHostPort(
		workspaceID,
		name,
		dbType,
		host,
		port,
		username,
		password,
		isHttps,
	)
}

