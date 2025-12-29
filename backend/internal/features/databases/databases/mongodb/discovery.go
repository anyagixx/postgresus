package mongodb

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DatabaseInfo represents information about a database on a MongoDB server
type DatabaseInfo struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`  // size in bytes
	Owner string `json:"owner"` // empty for MongoDB (not applicable)
}

// DiscoveryRequest contains server connection parameters for database discovery
type DiscoveryRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	IsHttps  bool   `json:"isHttps"`
}

// ListDatabasesOnServer connects to a MongoDB server and returns a list of all user databases
func ListDatabasesOnServer(req DiscoveryRequest) ([]DatabaseInfo, error) {
	// Use longer timeout since getting sizes for all databases can take time
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Build connection URI for discovery (connect without specifying a database)
	uri := buildDiscoveryURI(req)

	clientOptions := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}
	defer func() {
		if disconnectErr := client.Disconnect(ctx); disconnectErr != nil {
			// Log error but don't fail the function
			_ = disconnectErr
		}
	}()

	// Verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB server: %w", err)
	}

	// List all databases
	databases, err := client.ListDatabaseNames(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("failed to list databases: %w", err)
	}

	// Filter out system databases and get sizes
	var databaseInfos []DatabaseInfo
	systemDatabases := map[string]bool{
		"admin":    true,
		"config":   true,
		"local":    true,
		"test":     false, // test is a user database, include it
		"":         true,  // empty database name
	}

	for _, dbName := range databases {
		// Skip system databases
		if systemDatabases[dbName] {
			continue
		}

		dbInfo := DatabaseInfo{
			Name:  dbName,
			Size:  0, // Will be populated if we can get stats
			Owner: "", // MongoDB doesn't have a concept of database owner
		}

		// Try to get database size (optional, may fail for some databases)
		db := client.Database(dbName)
		var stats bson.M
		err := db.RunCommand(ctx, bson.D{{Key: "dbStats", Value: 1}}).Decode(&stats)
		if err == nil {
			if dataSize, ok := stats["dataSize"].(int64); ok {
				dbInfo.Size = dataSize
			} else if dataSizeFloat, ok := stats["dataSize"].(float64); ok {
				dbInfo.Size = int64(dataSizeFloat)
			}
		}
		// If getting stats fails, just continue with size 0

		databaseInfos = append(databaseInfos, dbInfo)
	}

	return databaseInfos, nil
}

// buildDiscoveryURI builds a MongoDB connection URI for server discovery (without database name)
func buildDiscoveryURI(req DiscoveryRequest) string {
	authDB := "admin" // Default auth database for discovery

	tlsOption := "false"
	if req.IsHttps {
		tlsOption = "true"
	}

	// Connect without specifying a database (use empty path after port)
	return fmt.Sprintf(
		"mongodb://%s:%s@%s:%d/?authSource=%s&tls=%s&connectTimeoutMS=60000",
		req.Username,
		req.Password,
		req.Host,
		req.Port,
		authDB,
		tlsOption,
	)
}



