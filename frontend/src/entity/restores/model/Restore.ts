import type { PostgresqlDatabase } from '../../databases';
import { RestoreStatus } from './RestoreStatus';

export interface Restore {
  id: string;
  status: RestoreStatus;

  postgresql?: PostgresqlDatabase;

  failMessage?: string;

  restoreDurationMs: number;
  createdAt: string;
}
