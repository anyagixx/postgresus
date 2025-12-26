package restores

import (
	"postgresus-backend/internal/features/databases/databases/mariadb"
	"postgresus-backend/internal/features/databases/databases/mongodb"
	"postgresus-backend/internal/features/databases/databases/mysql"
	"postgresus-backend/internal/features/databases/databases/postgresql"

	"github.com/google/uuid"
)

type RestoreBackupRequest struct {
	// TargetDatabaseId allows restoring to a different database by ID (uses stored credentials)
	TargetDatabaseId *uuid.UUID `json:"targetDatabaseId"`

	// Manual restore credentials (used when TargetDatabaseId is not provided)
	PostgresqlDatabase *postgresql.PostgresqlDatabase `json:"postgresqlDatabase"`
	MysqlDatabase      *mysql.MysqlDatabase           `json:"mysqlDatabase"`
	MariadbDatabase    *mariadb.MariadbDatabase       `json:"mariadbDatabase"`
	MongodbDatabase    *mongodb.MongodbDatabase       `json:"mongodbDatabase"`
}
