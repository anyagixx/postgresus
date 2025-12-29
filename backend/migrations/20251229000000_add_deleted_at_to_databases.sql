-- +goose Up
-- +goose StatementBegin

ALTER TABLE databases
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_databases_deleted_at ON databases (deleted_at);

CREATE INDEX idx_databases_workspace_deleted ON databases (workspace_id, deleted_at)
    WHERE deleted_at IS NOT NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP INDEX IF EXISTS idx_databases_workspace_deleted;
DROP INDEX IF EXISTS idx_databases_deleted_at;

ALTER TABLE databases
    DROP COLUMN IF EXISTS deleted_at;

-- +goose StatementEnd


