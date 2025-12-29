package servers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"postgresus-backend/internal/features/databases/databases/postgresql"
	"postgresus-backend/internal/storage"
	users_models "postgresus-backend/internal/features/users/models"
	"postgresus-backend/internal/util/encryption"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"gorm.io/gorm"
)


type ServerService struct {
	serverRepository *ServerRepository
	logger           *slog.Logger
	fieldEncryptor   encryption.FieldEncryptor
}

func (s *ServerService) CreateServer(
	user *users_models.User,
	workspaceID uuid.UUID,
	server *Server,
) (*Server, error) {
	if err := server.Validate(); err != nil {
		return nil, err
	}

	server.ID = uuid.New()
	server.WorkspaceID = &workspaceID
	server.CreatedAt = time.Now().UTC()
	server.UpdatedAt = time.Now().UTC()

	// Encrypt password before saving
	if err := server.EncryptSensitiveFields(s.fieldEncryptor); err != nil {
		return nil, fmt.Errorf("failed to encrypt server password: %w", err)
	}

	if err := s.serverRepository.Save(server); err != nil {
		return nil, err
	}

	// Hide sensitive data before returning
	server.HideSensitiveData()
	return server, nil
}

func (s *ServerService) UpdateServer(
	user *users_models.User,
	serverID uuid.UUID,
	incoming *Server,
) (*Server, error) {
	server, err := s.serverRepository.FindByID(serverID)
	if err != nil {
		return nil, err
	}

	server.Update(incoming)

	// If password was updated, encrypt it
	if incoming.Password != "" {
		if err := server.EncryptSensitiveFields(s.fieldEncryptor); err != nil {
			return nil, fmt.Errorf("failed to encrypt server password: %w", err)
		}
	}

	server.UpdatedAt = time.Now().UTC()

	if err := s.serverRepository.Save(server); err != nil {
		return nil, err
	}

	server.HideSensitiveData()
	return server, nil
}

func (s *ServerService) GetDatabasesByServerID(serverID uuid.UUID) ([]map[string]interface{}, error) {
	var databases []map[string]interface{}
	
	err := storage.GetDb().
		Table("databases").
		Select("databases.id, databases.name, databases.type, databases.workspace_id, databases.server_id").
		Joins("LEFT JOIN servers ON databases.server_id = servers.id").
		Where("databases.server_id = ? AND databases.deleted_at IS NULL", serverID).
		Order("databases.name ASC").
		Find(&databases).Error
	
	if err != nil {
		return nil, err
	}
	
	return databases, nil
}

func (s *ServerService) DeleteServer(
	user *users_models.User,
	serverID uuid.UUID,
) error {
	// Check if server exists
	server, err := s.serverRepository.FindByID(serverID)
	if err != nil {
		return fmt.Errorf("server not found: %w", err)
	}
	if server == nil {
		return errors.New("server not found")
	}

	// Check if there are databases linked to this server
	var dbCount int64
	if err := storage.GetDb().
		Table("databases").
		Where("server_id = ?", serverID).
		Count(&dbCount).Error; err != nil {
		return fmt.Errorf("failed to check linked databases: %w", err)
	}

	if dbCount > 0 {
		// Soft delete all linked databases (move to Trash)
		if err := storage.GetDb().
			Table("databases").
			Where("server_id = ?", serverID).
			Update("deleted_at", gorm.Expr("NOW()")).Error; err != nil {
			return fmt.Errorf("failed to soft delete databases: %w", err)
		}
		s.logger.Info("Soft deleted databases with server", "server_id", serverID, "count", dbCount)
	}

	// Delete the server
	return s.serverRepository.DeleteByID(serverID)
}

func (s *ServerService) GetServer(
	user *users_models.User,
	serverID uuid.UUID,
) (*Server, error) {
	server, err := s.serverRepository.FindByID(serverID)
	if err != nil {
		return nil, err
	}

	server.HideSensitiveData()
	return server, nil
}

func (s *ServerService) GetServerByID(serverID uuid.UUID) (*Server, error) {
	return s.serverRepository.FindByID(serverID)
}

func (s *ServerService) GetServers(
	user *users_models.User,
	workspaceID uuid.UUID,
) ([]*Server, error) {
	servers, err := s.serverRepository.FindByWorkspaceID(workspaceID)
	if err != nil {
		return nil, err
	}

	for _, server := range servers {
		server.HideSensitiveData()
	}

	return servers, nil
}

func (s *ServerService) GetOrCreateServerByHostPort(
	workspaceID uuid.UUID,
	name string,
	dbType string,
	host string,
	port int,
	username string,
	password string,
	isHttps bool,
) (*Server, error) {
	// Try to find existing server
	server, err := s.serverRepository.FindByHostPort(workspaceID, host, port)
	if err == nil && server != nil {
		return server, nil
	}

	// Create new server
	server = &Server{
		ID:          uuid.New(),
		WorkspaceID: &workspaceID,
		Name:        name,
		Type:        dbType,
		Host:        host,
		Port:        port,
		Username:    username,
		Password:    password,
		IsHttps:     isHttps,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := server.EncryptSensitiveFields(s.fieldEncryptor); err != nil {
		return nil, fmt.Errorf("failed to encrypt server password: %w", err)
	}

	if err := s.serverRepository.Save(server); err != nil {
		return nil, err
	}

	return server, nil
}

func (s *ServerService) TestConnection(
	user *users_models.User,
	server *Server,
) error {
	if server.Type != "postgresql" {
		return errors.New("only PostgreSQL server connection test is currently supported")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	sslMode := "prefer"
	if server.IsHttps {
		sslMode = "require"
	}

	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s",
		server.Host,
		server.Port,
		server.Username,
		server.Password,
		sslMode,
	)

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		return fmt.Errorf("failed to connect to server: %w", err)
	}
	defer conn.Close(ctx)

	return nil
}

func (s *ServerService) DiscoverDatabases(
	user *users_models.User,
	server *Server,
) ([]postgresql.DatabaseInfo, error) {
	if server.Type != "postgresql" {
		return nil, errors.New("only PostgreSQL database discovery is currently supported")
	}

	req := postgresql.DiscoveryRequest{
		Host:     server.Host,
		Port:     server.Port,
		Username: server.Username,
		Password: server.Password,
		IsHttps:  server.IsHttps,
	}

	return postgresql.ListDatabasesOnServer(req)
}
