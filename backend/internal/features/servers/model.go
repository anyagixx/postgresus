package servers

import (
	"errors"
	"time"

	"postgresus-backend/internal/features/databases"
	"postgresus-backend/internal/util/encryption"

	"github.com/google/uuid"
)

// Server represents a database server that can contain multiple databases
type Server struct {
	ID          uuid.UUID              `json:"id"          gorm:"column:id;primaryKey;type:uuid;default:gen_random_uuid()"`
	WorkspaceID *uuid.UUID             `json:"workspaceId" gorm:"column:workspace_id;type:uuid"`
	Name        string                 `json:"name"        gorm:"column:name;type:text;not null"`
	Type        databases.DatabaseType `json:"type"        gorm:"column:type;type:text;not null"`

	Host     string `json:"host"     gorm:"column:host;type:text;not null"`
	Port     int    `json:"port"     gorm:"column:port;type:integer;not null"`
	Username string `json:"username" gorm:"column:username;type:text;not null"`
	Password string `json:"password" gorm:"column:password;type:text;not null"`
	IsHttps  bool   `json:"isHttps"  gorm:"column:is_https;type:boolean;not null;default:false"`

	CreatedAt time.Time `json:"createdAt" gorm:"column:created_at;type:timestamp with time zone;not null;default:now()"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"column:updated_at;type:timestamp with time zone;not null;default:now()"`
}

func (s *Server) TableName() string {
	return "servers"
}

func (s *Server) Validate() error {
	if s.Name == "" {
		return errors.New("server name is required")
	}
	if s.Host == "" {
		return errors.New("host is required")
	}
	if s.Port == 0 {
		return errors.New("port is required")
	}
	if s.Username == "" {
		return errors.New("username is required")
	}
	if s.Password == "" {
		return errors.New("password is required")
	}
	if s.Type == "" {
		return errors.New("server type is required")
	}
	return nil
}

func (s *Server) HideSensitiveData() {
	s.Password = ""
}

func (s *Server) EncryptSensitiveFields(encryptor encryption.FieldEncryptor) error {
	if encryptor == nil {
		return nil
	}
	encryptedPassword, err := encryptor.Encrypt(s.ID, s.Password)
	if err != nil {
		return err
	}
	s.Password = encryptedPassword
	return nil
}

func (s *Server) Update(incoming *Server) {
	s.Name = incoming.Name
	s.Host = incoming.Host
	s.Port = incoming.Port
	s.Username = incoming.Username
	s.IsHttps = incoming.IsHttps
	s.UpdatedAt = time.Now().UTC()
	// Password is only updated if provided (non-empty)
	if incoming.Password != "" {
		s.Password = incoming.Password
	}
}
