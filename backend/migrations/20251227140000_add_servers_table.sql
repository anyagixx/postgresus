-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    is_https BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by workspace
CREATE INDEX IF NOT EXISTS idx_servers_workspace_id ON servers(workspace_id);

-- Create unique index for host:port within a workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_workspace_host_port ON servers(workspace_id, host, port);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS servers;
-- +goose StatementEnd
