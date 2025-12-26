package restores

import (
	"postgresus-backend/internal/features/databases/databases/mariadb"
	"postgresus-backend/internal/features/databases/databases/mongodb"
	"postgresus-backend/internal/features/databases/databases/mysql"
	"postgresus-backend/internal/features/databases/databases/postgresql"

	"github.com/google/uuid"
)

type RestoreBackupRequest struct {
	// TargetDatabaseId allows restoring to a different database by ID
	TargetDatabaseId *uuid.UUID `json:"targetDatabaseId"`

	// RestoreUsername and RestorePassword are credentials with full privileges (owner/superuser)
	// Used when TargetDatabaseId is provided - these override the stored read-only credentials
	RestoreUsername *string `json:"restoreUsername"`
	RestorePassword *string `json:"restorePassword"`

	// Manual restore credentials (used when TargetDatabaseId is not provided)
	PostgresqlDatabase *postgresql.PostgresqlDatabase `json:"postgresqlDatabase"`
	MysqlDatabase      *mysql.MysqlDatabase           `json:"mysqlDatabase"`
	MariadbDatabase    *mariadb.MariadbDatabase       `json:"mariadbDatabase"`
	MongodbDatabase    *mongodb.MongodbDatabase       `json:"mongodbDatabase"`
}
