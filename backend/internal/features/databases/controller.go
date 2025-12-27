package databases

import (
	"context"
	"log/slog"
	"net/http"
	"postgresus-backend/internal/features/databases/databases/postgresql"
	"postgresus-backend/internal/features/servers"
	users_middleware "postgresus-backend/internal/features/users/middleware"
	users_services "postgresus-backend/internal/features/users/services"
	workspaces_services "postgresus-backend/internal/features/workspaces/services"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DatabaseController struct {
	databaseService  *DatabaseService
	userService      *users_services.UserService
	workspaceService *workspaces_services.WorkspaceService
	serverService    *servers.ServerService
}

func (c *DatabaseController) RegisterRoutes(router *gin.RouterGroup) {
	router.POST("/databases/create", c.CreateDatabase)
	router.POST("/databases/create-batch", c.CreateDatabaseBatch)
	router.POST("/databases/update", c.UpdateDatabase)
	router.DELETE("/databases/:id", c.DeleteDatabase)
	router.GET("/databases/:id", c.GetDatabase)
	router.GET("/databases", c.GetDatabases)
	router.POST("/databases/:id/test-connection", c.TestDatabaseConnection)
	router.POST("/databases/test-connection-direct", c.TestDatabaseConnectionDirect)
	router.POST("/databases/discover", c.DiscoverDatabases)
	router.POST("/databases/:id/copy", c.CopyDatabase)
	router.GET("/databases/notifier/:id/is-using", c.IsNotifierUsing)
	router.POST("/databases/is-readonly", c.IsUserReadOnly)
	router.POST("/databases/create-readonly-user", c.CreateReadOnlyUser)
	router.POST("/databases/grant-readonly-access", c.GrantReadOnlyAccess)
}

// CreateDatabase
// @Summary Create a new database
// @Description Create a new database configuration in a workspace
// @Tags databases
// @Accept json
// @Produce json
// @Param request body Database true "Database creation data with workspaceId"
// @Success 201 {object} Database
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/create [post]
func (c *DatabaseController) CreateDatabase(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request Database
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.WorkspaceID == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "workspaceId is required"})
		return
	}

	database, err := c.databaseService.CreateDatabase(user, *request.WorkspaceID, &request)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, database)
}

// UpdateDatabase
// @Summary Update a database
// @Description Update an existing database configuration
// @Tags databases
// @Accept json
// @Produce json
// @Param request body Database true "Database update data"
// @Success 200 {object} Database
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/update [post]
func (c *DatabaseController) UpdateDatabase(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request Database
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.databaseService.UpdateDatabase(user, &request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, request)
}

// DeleteDatabase
// @Summary Delete a database
// @Description Delete a database configuration
// @Tags databases
// @Param id path string true "Database ID"
// @Success 204
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/{id} [delete]
func (c *DatabaseController) DeleteDatabase(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	if err := c.databaseService.DeleteDatabase(user, id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.Status(http.StatusNoContent)
}

// GetDatabase
// @Summary Get a database
// @Description Get a database configuration by ID
// @Tags databases
// @Produce json
// @Param id path string true "Database ID"
// @Success 200 {object} Database
// @Failure 400
// @Failure 401
// @Router /databases/{id} [get]
func (c *DatabaseController) GetDatabase(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	database, err := c.databaseService.GetDatabase(user, id)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, database)
}

// GetDatabases
// @Summary Get databases by workspace
// @Description Get all databases for a specific workspace
// @Tags databases
// @Produce json
// @Param workspace_id query string true "Workspace ID"
// @Success 200 {array} Database
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases [get]
func (c *DatabaseController) GetDatabases(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	workspaceIDStr := ctx.Query("workspace_id")
	if workspaceIDStr == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "workspace_id query parameter is required"})
		return
	}

	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspace_id"})
		return
	}

	databases, err := c.databaseService.GetDatabasesByWorkspace(user, workspaceID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, databases)
}

// TestDatabaseConnection
// @Summary Test database connection
// @Description Test connection to an existing database configuration
// @Tags databases
// @Param id path string true "Database ID"
// @Success 200
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/{id}/test-connection [post]
func (c *DatabaseController) TestDatabaseConnection(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	if err := c.databaseService.TestDatabaseConnection(user, id); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "connection successful"})
}

// TestDatabaseConnectionDirect
// @Summary Test database connection directly
// @Description Test connection to a database configuration without saving it
// @Tags databases
// @Accept json
// @Param request body Database true "Database configuration to test"
// @Success 200
// @Failure 400
// @Failure 401
// @Router /databases/test-connection-direct [post]
func (c *DatabaseController) TestDatabaseConnectionDirect(ctx *gin.Context) {
	_, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request Database
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := c.databaseService.TestDatabaseConnectionDirect(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "connection successful"})
}

// IsNotifierUsing
// @Summary Check if notifier is being used
// @Description Check if a notifier is currently being used by any database
// @Tags databases
// @Produce json
// @Param id path string true "Notifier ID"
// @Success 200 {object} map[string]bool
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/notifier/{id}/is-using [get]
func (c *DatabaseController) IsNotifierUsing(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid notifier ID"})
		return
	}

	isUsing, err := c.databaseService.IsNotifierUsing(user, id)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"isUsing": isUsing})
}

// CopyDatabase
// @Summary Copy a database
// @Description Copy an existing database configuration
// @Tags databases
// @Produce json
// @Param id path string true "Database ID"
// @Success 201 {object} Database
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/{id}/copy [post]
func (c *DatabaseController) CopyDatabase(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	id, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid database ID"})
		return
	}

	copiedDatabase, err := c.databaseService.CopyDatabase(user, id)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, copiedDatabase)
}

// IsUserReadOnly
// @Summary Check if database user is read-only
// @Description Check if current database credentials have only read (SELECT) privileges
// @Tags databases
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Database true "Database configuration to check"
// @Success 200 {object} IsReadOnlyResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /databases/is-readonly [post]
func (c *DatabaseController) IsUserReadOnly(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request Database
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isReadOnly, err := c.databaseService.IsUserReadOnly(user, &request)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, IsReadOnlyResponse{IsReadOnly: isReadOnly})
}

// CreateReadOnlyUser
// @Summary Create read-only database user
// @Description Create a new PostgreSQL user with read-only privileges for backup operations
// @Tags databases
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body Database true "Database configuration to create user for"
// @Success 200 {object} CreateReadOnlyUserResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /databases/create-readonly-user [post]
func (c *DatabaseController) CreateReadOnlyUser(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request Database
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	username, password, err := c.databaseService.CreateReadOnlyUser(user, &request)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, CreateReadOnlyUserResponse{
		Username: username,
		Password: password,
	})
}

// DiscoverDatabases
// @Summary Discover databases on a server
// @Description Connect to a PostgreSQL server and list all available databases
// @Tags databases
// @Accept json
// @Produce json
// @Param request body postgresql.DiscoveryRequest true "Server connection data"
// @Success 200 {array} postgresql.DatabaseInfo
// @Failure 400
// @Failure 401
// @Router /databases/discover [post]
func (c *DatabaseController) DiscoverDatabases(ctx *gin.Context) {
	_, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request postgresql.DiscoveryRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	databases, err := postgresql.ListDatabasesOnServer(request)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"databases": databases})
}

// CreateDatabaseBatchRequest represents request for batch database creation
type CreateDatabaseBatchRequest struct {
	WorkspaceID uuid.UUID  `json:"workspaceId"`
	Databases   []Database `json:"databases"`

	// Server information for grouping databases
	ServerName string `json:"serverName"` // User-friendly name like "Production Server"
	Host       string `json:"host"`       // Server host
	Port       int    `json:"port"`       // Server port
	Username   string `json:"username"`   // Connection username
	Password   string `json:"password"`   // Connection password
	IsHttps    bool   `json:"isHttps"`    // SSL/TLS required
}

// CreateDatabaseBatch
// @Summary Create multiple databases at once
// @Description Create multiple database configurations in a workspace with shared settings
// @Tags databases
// @Accept json
// @Produce json
// @Param request body CreateDatabaseBatchRequest true "Batch creation data"
// @Success 201 {array} Database
// @Failure 400
// @Failure 401
// @Failure 500
// @Router /databases/create-batch [post]
func (c *DatabaseController) CreateDatabaseBatch(ctx *gin.Context) {
	user, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request CreateDatabaseBatchRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if request.WorkspaceID == uuid.Nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "workspaceId is required"})
		return
	}

	// Create or get server if server info is provided
	var serverID *uuid.UUID
	if request.ServerName != "" && request.Host != "" && request.Port > 0 {
		// Determine database type from first database
		if len(request.Databases) == 0 {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "at least one database is required"})
			return
		}
		dbType := request.Databases[0].Type

		server, err := c.serverService.GetOrCreateServerByHostPort(
			request.WorkspaceID,
			request.ServerName,
			dbType,
			request.Host,
			request.Port,
			request.Username,
			request.Password,
			request.IsHttps,
		)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "failed to create server: " + err.Error()})
			return
		}
		serverID = &server.ID
	}

	var createdDatabases []*Database
	for i := range request.Databases {
		// Assign server ID to each database
		request.Databases[i].ServerID = serverID

		database, err := c.databaseService.CreateDatabase(user, request.WorkspaceID, &request.Databases[i])
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{
				"error":          err.Error(),
				"failedDatabase": request.Databases[i].Name,
			})
			return
		}
		createdDatabases = append(createdDatabases, database)
	}

	ctx.JSON(http.StatusCreated, createdDatabases)
}

// GrantReadOnlyAccess
// @Summary Grant read-only access to multiple databases
// @Description Grant read-only privileges to an existing user on multiple databases
// @Tags databases
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body GrantReadOnlyAccessRequest true "Grant access request"
// @Success 200 {object} GrantReadOnlyAccessResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /databases/grant-readonly-access [post]
func (c *DatabaseController) GrantReadOnlyAccess(ctx *gin.Context) {
	_, ok := users_middleware.GetUserFromContext(ctx)
	if !ok {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var request GrantReadOnlyAccessRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(request.Databases) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "at least one database is required"})
		return
	}

	logger := slog.Default()
	grantCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var grantedDatabases []string
	var failedDatabases []string
	var errors []string

	for _, dbName := range request.Databases {
		err := postgresql.GrantReadOnlyAccess(
			grantCtx,
			logger,
			request.Host,
			request.Port,
			request.AdminUsername,
			request.AdminPassword,
			request.IsHttps,
			dbName,
			request.Username,
		)
		if err != nil {
			failedDatabases = append(failedDatabases, dbName)
			errors = append(errors, err.Error())
		} else {
			grantedDatabases = append(grantedDatabases, dbName)
		}
	}

	ctx.JSON(http.StatusOK, GrantReadOnlyAccessResponse{
		Success:          len(failedDatabases) == 0,
		GrantedDatabases: grantedDatabases,
		FailedDatabases:  failedDatabases,
		Errors:           errors,
	})
}
