package backups

type BackupStatus string

const (
	BackupStatusInProgress BackupStatus = "IN_PROGRESS"
	BackupStatusCompleted  BackupStatus = "COMPLETED"
	BackupStatusFailed     BackupStatus = "FAILED"
	BackupStatusCanceled   BackupStatus = "CANCELED"
)

type ValidationStatus string

const (
	ValidationStatusNotValidated ValidationStatus = "NOT_VALIDATED"
	ValidationStatusPending      ValidationStatus = "PENDING"
	ValidationStatusValid         ValidationStatus = "VALID"
	ValidationStatusInvalid       ValidationStatus = "INVALID"
)
