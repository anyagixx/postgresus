package mariadb

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// DatabaseInfo represents information about a database on a MariaDB server
type DatabaseInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`  // size in bytes
	Owner string `json:"owner"` // empty for MariaDB (not applicable)
}

// DiscoveryRequest contains server connection parameters for database discovery
type DiscoveryRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	IsHttps  bool   `json:"isHttps"`
}

// ListDatabasesOnServer connects to a MariaDB server and returns a list of all user databases
func ListDatabasesOnServer(req DiscoveryRequest) ([]DatabaseInfo, error) {
	// Use longer timeout since getting sizes for all databases can take time
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Connect without specifying a database (use empty string)
	dsn := buildDiscoveryDSN(req)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			// Log error but don't fail the function
			_ = closeErr
		}
	}()

	db.SetConnMaxLifetime(60 * time.Second)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Verify connection
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping MariaDB server: %w", err)
	}

	// Query all databases with their sizes in a single query to avoid multiple round-trips
	// This is much faster than querying each database separately
	// MariaDB uses the same INFORMATION_SCHEMA as MySQL
	rows, err := db.QueryContext(ctx, `
		SELECT 
			s.SCHEMA_NAME,
			COALESCE(SUM(t.data_length + t.index_length), 0) as size
		FROM INFORMATION_SCHEMA.SCHEMATA s
		LEFT JOIN INFORMATION_SCHEMA.TABLES t ON s.SCHEMA_NAME = t.table_schema
		WHERE s.SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
		GROUP BY s.SCHEMA_NAME
		ORDER BY s.SCHEMA_NAME
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query databases: %w", err)
	}
	defer rows.Close()

	var databases []DatabaseInfo
	for rows.Next() {
		var dbInfo DatabaseInfo
		var size sql.NullInt64
		if err := rows.Scan(&dbInfo.Name, &size); err != nil {
			return nil, fmt.Errorf("failed to scan database info: %w", err)
		}

		if size.Valid {
			dbInfo.Size = size.Int64
		} else {
			dbInfo.Size = 0
		}
		dbInfo.Owner = "" // MariaDB doesn't have a concept of database owner in the same way PostgreSQL does

		databases = append(databases, dbInfo)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating databases: %w", err)
	}

	return databases, nil
}

// buildDiscoveryDSN builds DSN connection string for server discovery (without database name)
func buildDiscoveryDSN(req DiscoveryRequest) string {
	tlsConfig := "false"
	if req.IsHttps {
		tlsConfig = "true"
	}

	// Connect without specifying a database (no database name in DSN)
	// Increased timeout to 60s to match context timeout
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/?parseTime=true&timeout=60s&readTimeout=60s&writeTimeout=60s&tls=%s&charset=utf8mb4",
		req.Username,
		req.Password,
		req.Host,
		req.Port,
		tlsConfig,
	)
}





