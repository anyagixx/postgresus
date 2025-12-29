package databases

type CreateReadOnlyUserResponse struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type IsReadOnlyResponse struct {
	IsReadOnly bool `json:"isReadOnly"`
}

// GrantReadOnlyAccessRequest is the request body for granting read-only access
// to an existing user on multiple databases
type GrantReadOnlyAccessRequest struct {
	// Username of the read-only user to grant access to
	Username string `json:"username" binding:"required"`
	// Server connection details (admin credentials)
	Host     string `json:"host" binding:"required"`
	Port     int    `json:"port" binding:"required"`
	AdminUsername string `json:"adminUsername" binding:"required"`
	AdminPassword string `json:"adminPassword" binding:"required"`
	IsHttps  bool   `json:"isHttps"`
	// List of database names to grant access to
	Databases []string `json:"databases" binding:"required"`
}

type GrantReadOnlyAccessResponse struct {
	Success        bool     `json:"success"`
	GrantedDatabases []string `json:"grantedDatabases"`
	FailedDatabases  []string `json:"failedDatabases"`
	Errors         []string `json:"errors,omitempty"`
}
