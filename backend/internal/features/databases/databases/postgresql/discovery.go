package postgresql

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// DatabaseInfo represents information about a database on a PostgreSQL server
type DatabaseInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`  // size in bytes
	Owner string `json:"owner"`
}

// DiscoveryRequest contains server connection parameters for database discovery
type DiscoveryRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	IsHttps  bool   `json:"isHttps"`
}

// ListDatabasesOnServer connects to a PostgreSQL server and returns a list of all user databases
func ListDatabasesOnServer(req DiscoveryRequest) ([]DatabaseInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Connect to the default 'postgres' database to list all databases
	connStr := buildDiscoveryConnectionString(req)

	conn, err := pgx.Connect(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}
	defer conn.Close(ctx)

	// Query all non-template databases, excluding system databases
	rows, err := conn.Query(ctx, `
		SELECT 
			datname,
			pg_database_size(datname),
			pg_catalog.pg_get_userbyid(datdba)
		FROM pg_database 
		WHERE datistemplate = false 
		AND datname NOT IN ('postgres', 'template0', 'template1')
		ORDER BY datname
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query databases: %w", err)
	}
	defer rows.Close()

	var databases []DatabaseInfo
	for rows.Next() {
		var db DatabaseInfo
		if err := rows.Scan(&db.Name, &db.Size, &db.Owner); err != nil {
			return nil, fmt.Errorf("failed to scan database info: %w", err)
		}
		databases = append(databases, db)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating databases: %w", err)
	}

	return databases, nil
}

// buildDiscoveryConnectionString builds connection string for server discovery
func buildDiscoveryConnectionString(req DiscoveryRequest) string {
	sslMode := "disable"
	if req.IsHttps {
		sslMode = "require"
	}

	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=postgres sslmode=%s",
		req.Host,
		req.Port,
		req.Username,
		req.Password,
		sslMode,
	)
}
