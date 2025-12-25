package enums

type RestoreStatus string

const (
	RestoreStatusInProgress RestoreStatus = "IN_PROGRESS"
	RestoreStatusCompleted  RestoreStatus = "COMPLETED"
	RestoreStatusFailed     RestoreStatus = "FAILED"
)
