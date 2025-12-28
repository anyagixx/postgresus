-- +goose Up
-- +goose StatementBegin
-- Add deleted_at column to databases table for soft delete
ALTER TABLE databases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries filtering deleted databases
CREATE INDEX IF NOT EXISTS idx_databases_deleted_at ON databases(deleted_at) WHERE deleted_at IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_databases_deleted_at;
ALTER TABLE databases DROP COLUMN IF EXISTS deleted_at;
-- +goose StatementEnd

