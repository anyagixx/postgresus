package databases

import (
	"errors"
	"fmt"
	"log/slog"
	"postgresus-backend/internal/features/databases/databases/mariadb"
	"postgresus-backend/internal/features/databases/databases/mongodb"
	"postgresus-backend/internal/features/databases/databases/mysql"
	"postgresus-backend/internal/features/databases/databases/postgresql"
	"postgresus-backend/internal/features/notifiers"
	"postgresus-backend/internal/util/encryption"
	"time"

	"github.com/google/uuid"
)

type Database struct {
	ID uuid.UUID `json:"id" gorm:"column:id;primaryKey;type:uuid;default:gen_random_uuid()"`

	// WorkspaceID can be null when a database is created via restore operation
	// outside the context of any workspace
	WorkspaceID *uuid.UUID   `json:"workspaceId" gorm:"column:workspace_id;type:uuid"`
	Name        string       `json:"name"        gorm:"column:name;type:text;not null"`
	Type        DatabaseType `json:"type"        gorm:"column:type;type:text;not null"`

	// ServerID links this database to a server (optional for backward compatibility)
	ServerID   *uuid.UUID `json:"serverId,omitempty"   gorm:"column:server_id;type:uuid"`
	ServerName string     `json:"serverName,omitempty" gorm:"column:server_name;->"` // Populated from join, read-only

	Postgresql *postgresql.PostgresqlDatabase `json:"postgresql,omitempty" gorm:"foreignKey:DatabaseID"`
	Mysql      *mysql.MysqlDatabase           `json:"mysql,omitempty"      gorm:"foreignKey:DatabaseID"`
	Mariadb    *mariadb.MariadbDatabase       `json:"mariadb,omitempty"    gorm:"foreignKey:DatabaseID"`
	Mongodb    *mongodb.MongodbDatabase       `json:"mongodb,omitempty"    gorm:"foreignKey:DatabaseID"`

	Notifiers []notifiers.Notifier `json:"notifiers" gorm:"many2many:database_notifiers;"`

	// these fields are not reliable, but
	// they are used for pretty UI
	LastBackupTime         *time.Time `json:"lastBackupTime,omitempty"         gorm:"column:last_backup_time;type:timestamp with time zone"`
	LastBackupErrorMessage *string    `json:"lastBackupErrorMessage,omitempty" gorm:"column:last_backup_error_message;type:text"`

	HealthStatus *HealthStatus `json:"healthStatus" gorm:"column:health_status;type:text;not null"`

	// Soft delete support
	DeletedAt *time.Time `json:"deletedAt,omitempty" gorm:"column:deleted_at;type:timestamp with time zone"`
}

func (d *Database) Validate() error {
	if d.Name == "" {
		return errors.New("name is required")
	}

	switch d.Type {
	case DatabaseTypePostgres:
		if d.Postgresql == nil {
			return errors.New("postgresql database is required")
		}
		return d.Postgresql.Validate()
	case DatabaseTypeMysql:
		if d.Mysql == nil {
			return errors.New("mysql database is required")
		}
		return d.Mysql.Validate()
	case DatabaseTypeMariadb:
		if d.Mariadb == nil {
			return errors.New("mariadb database is required")
		}
		return d.Mariadb.Validate()
	case DatabaseTypeMongodb:
		if d.Mongodb == nil {
			return errors.New("mongodb database is required")
		}
		return d.Mongodb.Validate()
	default:
		return errors.New("invalid database type: " + string(d.Type))
	}
}

func (d *Database) ValidateUpdate(old, new Database) error {
	if old.Type != new.Type {
		return errors.New("database type is not allowed to change")
	}

	return nil
}

func (d *Database) TestConnection(
	logger *slog.Logger,
	encryptor encryption.FieldEncryptor,
) error {
	return d.getSpecificDatabase().TestConnection(logger, encryptor, d.ID)
}

func (d *Database) HideSensitiveData() {
	d.getSpecificDatabase().HideSensitiveData()
}

func (d *Database) EncryptSensitiveFields(encryptor encryption.FieldEncryptor) error {
	// Use database type instead of checking which structure is not nil
	// This prevents calling wrong method when multiple structures are set
	switch d.Type {
	case DatabaseTypePostgres:
		if d.Postgresql == nil {
			return errors.New("postgresql configuration is missing")
		}
		return d.Postgresql.EncryptSensitiveFields(d.ID, encryptor)
	case DatabaseTypeMysql:
		if d.Mysql == nil {
			return errors.New("mysql configuration is missing")
		}
		return d.Mysql.EncryptSensitiveFields(d.ID, encryptor)
	case DatabaseTypeMariadb:
		if d.Mariadb == nil {
			return errors.New("mariadb configuration is missing")
		}
		return d.Mariadb.EncryptSensitiveFields(d.ID, encryptor)
	case DatabaseTypeMongodb:
		if d.Mongodb == nil {
			return errors.New("mongodb configuration is missing")
		}
		return d.Mongodb.EncryptSensitiveFields(d.ID, encryptor)
	default:
		return fmt.Errorf("unsupported database type: %s", d.Type)
	}
}

func (d *Database) PopulateVersionIfEmpty(
	logger *slog.Logger,
	encryptor encryption.FieldEncryptor,
) error {
	// Use database type instead of checking which structure is not nil
	// This prevents calling wrong method when multiple structures are set
	switch d.Type {
	case DatabaseTypePostgres:
		if d.Postgresql == nil {
			return errors.New("postgresql configuration is missing")
		}
		return d.Postgresql.PopulateVersionIfEmpty(logger, encryptor, d.ID)
	case DatabaseTypeMysql:
		if d.Mysql == nil {
			return errors.New("mysql configuration is missing")
		}
		return d.Mysql.PopulateVersionIfEmpty(logger, encryptor, d.ID)
	case DatabaseTypeMariadb:
		if d.Mariadb == nil {
			return errors.New("mariadb configuration is missing")
		}
		return d.Mariadb.PopulateVersionIfEmpty(logger, encryptor, d.ID)
	case DatabaseTypeMongodb:
		if d.Mongodb == nil {
			return errors.New("mongodb configuration is missing")
		}
		return d.Mongodb.PopulateVersionIfEmpty(logger, encryptor, d.ID)
	default:
		return fmt.Errorf("unsupported database type: %s", d.Type)
	}
}

func (d *Database) Update(incoming *Database) {
	d.Name = incoming.Name
	d.Type = incoming.Type
	d.Notifiers = incoming.Notifiers
	d.ServerID = incoming.ServerID

	switch d.Type {
	case DatabaseTypePostgres:
		if d.Postgresql != nil && incoming.Postgresql != nil {
			d.Postgresql.Update(incoming.Postgresql)
		}
	case DatabaseTypeMysql:
		if d.Mysql != nil && incoming.Mysql != nil {
			d.Mysql.Update(incoming.Mysql)
		}
	case DatabaseTypeMariadb:
		if d.Mariadb != nil && incoming.Mariadb != nil {
			d.Mariadb.Update(incoming.Mariadb)
		}
	case DatabaseTypeMongodb:
		if d.Mongodb != nil && incoming.Mongodb != nil {
			d.Mongodb.Update(incoming.Mongodb)
		}
	}
}

func (d *Database) getSpecificDatabase() DatabaseConnector {
	switch d.Type {
	case DatabaseTypePostgres:
		if d.Postgresql == nil {
			panic("postgresql configuration is missing for PostgreSQL database")
		}
		return d.Postgresql
	case DatabaseTypeMysql:
		if d.Mysql == nil {
			panic("mysql configuration is missing for MySQL database")
		}
		return d.Mysql
	case DatabaseTypeMariadb:
		if d.Mariadb == nil {
			panic("mariadb configuration is missing for MariaDB database")
		}
		return d.Mariadb
	case DatabaseTypeMongodb:
		if d.Mongodb == nil {
			panic("mongodb configuration is missing for MongoDB database")
		}
		return d.Mongodb
	}

	panic("invalid database type: " + string(d.Type))
}
