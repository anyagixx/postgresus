package databases

import (
	"errors"
	"fmt"
	"postgresus-backend/internal/storage"
	"postgresus-backend/internal/util/encryption"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Server represents a database server (minimal struct to avoid circular dependency)
type serverForBatch struct {
	ID          uuid.UUID  `gorm:"column:id;primaryKey;type:uuid"`
	WorkspaceID *uuid.UUID `gorm:"column:workspace_id;type:uuid"`
	Name        string     `gorm:"column:name;type:text;not null"`
	Type        string     `gorm:"column:type;type:text;not null"`
	Host        string     `gorm:"column:host;type:text;not null"`
	Port        int        `gorm:"column:port;type:integer;not null"`
	Username    string     `gorm:"column:username;type:text;not null"`
	Password    string     `gorm:"column:password;type:text;not null"`
	IsHttps     bool       `gorm:"column:is_https;type:boolean;not null;default:false"`
	CreatedAt   time.Time  `gorm:"column:created_at;type:timestamp with time zone;not null;default:now()"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;type:timestamp with time zone;not null;default:now()"`
}

func (s *serverForBatch) TableName() string {
	return "servers"
}

// createOrGetServer creates or gets a server by host and port
// This is a helper function to avoid circular dependency with servers package
func (c *DatabaseController) createOrGetServer(
	workspaceID uuid.UUID,
	name string,
	dbType string,
	host string,
	port int,
	username string,
	password string,
	isHttps bool,
) (*uuid.UUID, error) {
	db := storage.GetDb()
	fieldEncryptor := encryption.GetFieldEncryptor()

	// Try to find existing server
	var existingServer serverForBatch
	err := db.Where("workspace_id = ? AND host = ? AND port = ?", workspaceID, host, port).First(&existingServer).Error
	if err == nil {
		// Server exists, return its ID
		return &existingServer.ID, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("failed to check for existing server: %w", err)
	}

	// Create new server
	serverID := uuid.New()
	server := &serverForBatch{
		ID:          serverID,
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

	// Encrypt password
	if fieldEncryptor != nil {
		encryptedPassword, err := fieldEncryptor.Encrypt(serverID, password)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt server password: %w", err)
		}
		server.Password = encryptedPassword
	}

	// Validate
	if server.Name == "" {
		return nil, errors.New("server name is required")
	}
	if server.Host == "" {
		return nil, errors.New("host is required")
	}
	if server.Port == 0 {
		return nil, errors.New("port is required")
	}
	if server.Username == "" {
		return nil, errors.New("username is required")
	}
	if server.Password == "" {
		return nil, errors.New("password is required")
	}
	if server.Type == "" {
		return nil, errors.New("server type is required")
	}

	// Save server
	if err := db.Create(server).Error; err != nil {
		return nil, fmt.Errorf("failed to create server: %w", err)
	}

	return &serverID, nil
}


