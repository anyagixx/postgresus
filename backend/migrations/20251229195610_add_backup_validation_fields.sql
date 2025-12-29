-- +goose Up
-- +goose StatementBegin

ALTER TABLE backups
    ADD COLUMN validation_status TEXT,
    ADD COLUMN validated_at TIMESTAMPTZ,
    ADD COLUMN validation_error TEXT,
    ADD COLUMN validation_details TEXT;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE backups
    DROP COLUMN IF EXISTS validation_status,
    DROP COLUMN IF EXISTS validated_at,
    DROP COLUMN IF EXISTS validation_error,
    DROP COLUMN IF EXISTS validation_details;

-- +goose StatementEnd


