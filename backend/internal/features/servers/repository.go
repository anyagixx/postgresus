package servers

import (
	"postgresus-backend/internal/db"

	"github.com/google/uuid"
)

type ServerRepository struct{}

func (r *ServerRepository) Save(server *Server) error {
	return db.GetDB().Save(server).Error
}

func (r *ServerRepository) FindByID(id uuid.UUID) (*Server, error) {
	var server Server
	if err := db.GetDB().Where("id = ?", id).First(&server).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *ServerRepository) FindByWorkspaceID(workspaceID uuid.UUID) ([]*Server, error) {
	var servers []*Server
	if err := db.GetDB().Where("workspace_id = ?", workspaceID).Order("name").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

func (r *ServerRepository) FindByHostPort(workspaceID uuid.UUID, host string, port int) (*Server, error) {
	var server Server
	if err := db.GetDB().Where("workspace_id = ? AND host = ? AND port = ?", workspaceID, host, port).First(&server).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

func (r *ServerRepository) DeleteByID(id uuid.UUID) error {
	return db.GetDB().Where("id = ?", id).Delete(&Server{}).Error
}

func (r *ServerRepository) GetAllServers() ([]*Server, error) {
	var servers []*Server
	if err := db.GetDB().Order("name").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}
