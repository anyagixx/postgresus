package servers

import (
	"net/http"

	"postgresus-backend/internal/features/databases"
	users_models "postgresus-backend/internal/features/users/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ServerController struct {
	serverService *ServerService
}

// CreateServerRequest represents the request body for creating a server
type CreateServerRequest struct {
	Name     string                 `json:"name"     binding:"required"`
	Type     databases.DatabaseType `json:"type"     binding:"required"`
	Host     string                 `json:"host"     binding:"required"`
	Port     int                    `json:"port"     binding:"required"`
	Username string                 `json:"username" binding:"required"`
	Password string                 `json:"password" binding:"required"`
	IsHttps  bool                   `json:"isHttps"`
}

// UpdateServerRequest represents the request body for updating a server
type UpdateServerRequest struct {
	Name     string `json:"name"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"` // Optional - only update if provided
	IsHttps  bool   `json:"isHttps"`
}

// TestConnectionRequest represents the request body for testing server connection
type TestConnectionRequest struct {
	Type     databases.DatabaseType `json:"type"     binding:"required"`
	Host     string                 `json:"host"     binding:"required"`
	Port     int                    `json:"port"     binding:"required"`
	Username string                 `json:"username" binding:"required"`
	Password string                 `json:"password" binding:"required"`
	IsHttps  bool                   `json:"isHttps"`
}

// RegisterRoutes registers all server-related routes
func (c *ServerController) RegisterRoutes(router *gin.RouterGroup) {
	servers := router.Group("/servers")
	{
		servers.GET("", c.GetServers)
		servers.POST("", c.CreateServer)
		servers.GET("/:serverId", c.GetServer)
		servers.PUT("/:serverId", c.UpdateServer)
		servers.DELETE("/:serverId", c.DeleteServer)
		servers.POST("/test-connection", c.TestConnection)
	}
}

// GetServers godoc
// @Summary Get all servers in workspace
// @Description Get all servers in the specified workspace
// @Tags servers
// @Accept json
// @Produce json
// @Param workspaceId path string true "Workspace ID"
// @Success 200 {array} Server
// @Router /api/v1/workspaces/{workspaceId}/servers [get]
func (c *ServerController) GetServers(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)
	workspaceID, err := uuid.Parse(ctx.Param("workspaceId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	servers, err := c.serverService.GetServers(user, workspaceID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, servers)
}

// CreateServer godoc
// @Summary Create a new server
// @Description Create a new server in the specified workspace
// @Tags servers
// @Accept json
// @Produce json
// @Param workspaceId path string true "Workspace ID"
// @Param request body CreateServerRequest true "Server data"
// @Success 201 {object} Server
// @Router /api/v1/workspaces/{workspaceId}/servers [post]
func (c *ServerController) CreateServer(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)
	workspaceID, err := uuid.Parse(ctx.Param("workspaceId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid workspace ID"})
		return
	}

	var request CreateServerRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server := &Server{
		Name:     request.Name,
		Type:     request.Type,
		Host:     request.Host,
		Port:     request.Port,
		Username: request.Username,
		Password: request.Password,
		IsHttps:  request.IsHttps,
	}

	createdServer, err := c.serverService.CreateServer(user, workspaceID, server)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, createdServer)
}

// GetServer godoc
// @Summary Get a server by ID
// @Description Get a specific server by its ID
// @Tags servers
// @Accept json
// @Produce json
// @Param serverId path string true "Server ID"
// @Success 200 {object} Server
// @Router /api/v1/workspaces/{workspaceId}/servers/{serverId} [get]
func (c *ServerController) GetServer(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)
	serverID, err := uuid.Parse(ctx.Param("serverId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	server, err := c.serverService.GetServer(user, serverID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Server not found"})
		return
	}

	ctx.JSON(http.StatusOK, server)
}

// UpdateServer godoc
// @Summary Update a server
// @Description Update an existing server
// @Tags servers
// @Accept json
// @Produce json
// @Param serverId path string true "Server ID"
// @Param request body UpdateServerRequest true "Server data"
// @Success 200 {object} Server
// @Router /api/v1/workspaces/{workspaceId}/servers/{serverId} [put]
func (c *ServerController) UpdateServer(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)
	serverID, err := uuid.Parse(ctx.Param("serverId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	var request UpdateServerRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server := &Server{
		Name:     request.Name,
		Host:     request.Host,
		Port:     request.Port,
		Username: request.Username,
		Password: request.Password,
		IsHttps:  request.IsHttps,
	}

	updatedServer, err := c.serverService.UpdateServer(user, serverID, server)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, updatedServer)
}

// DeleteServer godoc
// @Summary Delete a server
// @Description Delete a server by its ID
// @Tags servers
// @Accept json
// @Produce json
// @Param serverId path string true "Server ID"
// @Success 200 {object} map[string]string
// @Router /api/v1/workspaces/{workspaceId}/servers/{serverId} [delete]
func (c *ServerController) DeleteServer(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)
	serverID, err := uuid.Parse(ctx.Param("serverId"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid server ID"})
		return
	}

	if err := c.serverService.DeleteServer(user, serverID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Server deleted successfully"})
}

// TestConnection godoc
// @Summary Test server connection
// @Description Test connection to a database server
// @Tags servers
// @Accept json
// @Produce json
// @Param request body TestConnectionRequest true "Server connection data"
// @Success 200 {object} map[string]string
// @Router /api/v1/workspaces/{workspaceId}/servers/test-connection [post]
func (c *ServerController) TestConnection(ctx *gin.Context) {
	user := ctx.MustGet("user").(*users_models.User)

	var request TestConnectionRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	server := &Server{
		Type:     request.Type,
		Host:     request.Host,
		Port:     request.Port,
		Username: request.Username,
		Password: request.Password,
		IsHttps:  request.IsHttps,
	}

	if err := c.serverService.TestConnection(user, server); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Connection successful"})
}
