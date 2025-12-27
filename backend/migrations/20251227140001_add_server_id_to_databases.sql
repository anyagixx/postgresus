-- +goose Up
-- +goose StatementBegin
-- Add server_id column to databases table
ALTER TABLE databases ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES servers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_databases_server_id ON databases(server_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_databases_server_id;
ALTER TABLE databases DROP COLUMN IF EXISTS server_id;
-- +goose StatementEnd
