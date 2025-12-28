package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// DatabaseInfo represents information about a database on a MySQL server
type DatabaseInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`  // size in bytes
	Owner string `json:"owner"` // empty for MySQL (not applicable)
}

// DiscoveryRequest contains server connection parameters for database discovery
type DiscoveryRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	IsHttps  bool   `json:"isHttps"`
}

// ListDatabasesOnServer connects to a MySQL server and returns a list of all user databases
func ListDatabasesOnServer(req DiscoveryRequest) ([]DatabaseInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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

	db.SetConnMaxLifetime(30 * time.Second)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Verify connection
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping MySQL server: %w", err)
	}

	// Query all databases, excluding system databases
	rows, err := db.QueryContext(ctx, `
		SELECT SCHEMA_NAME 
		FROM INFORMATION_SCHEMA.SCHEMATA 
		WHERE SCHEMA_NAME NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
		ORDER BY SCHEMA_NAME
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query databases: %w", err)
	}
	defer rows.Close()

	var databases []DatabaseInfo
	for rows.Next() {
		var dbName string
		if err := rows.Scan(&dbName); err != nil {
			return nil, fmt.Errorf("failed to scan database name: %w", err)
		}

		// Get database size
		size, err := getDatabaseSize(ctx, db, dbName)
		if err != nil {
			// Log error but continue with size = 0
			size = 0
		}

		databases = append(databases, DatabaseInfo{
			Name:  dbName,
			Size:  size,
			Owner: "", // MySQL doesn't have a concept of database owner in the same way PostgreSQL does
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating databases: %w", err)
	}

	return databases, nil
}

// getDatabaseSize calculates the total size of a database by summing up all table sizes
func getDatabaseSize(ctx context.Context, db *sql.DB, dbName string) (int64, error) {
	var size sql.NullInt64
	err := db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(data_length + index_length), 0) as size
		FROM information_schema.tables
		WHERE table_schema = ?
	`, dbName).Scan(&size)
	if err != nil {
		return 0, fmt.Errorf("failed to get database size: %w", err)
	}
	if !size.Valid {
		return 0, nil
	}
	return size.Int64, nil
}

// buildDiscoveryDSN builds DSN connection string for server discovery (without database name)
func buildDiscoveryDSN(req DiscoveryRequest) string {
	tlsConfig := "false"
	if req.IsHttps {
		tlsConfig = "true"
	}

	// Connect without specifying a database (no database name in DSN)
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%d)/?parseTime=true&timeout=30s&tls=%s&charset=utf8mb4",
		req.Username,
		req.Password,
		req.Host,
		req.Port,
		tlsConfig,
	)
}

