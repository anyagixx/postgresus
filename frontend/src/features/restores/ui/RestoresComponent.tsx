import { CopyOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { CheckCircleOutlined } from '@ant-design/icons';
import { App, Button, Input, Modal, Select, Spin, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Backup } from '../../../entity/backups';
import { type Database, DatabaseType, databaseApi } from '../../../entity/databases';
import { type Restore, RestoreStatus, restoreApi } from '../../../entity/restores';
import { getUserTimeFormat } from '../../../shared/time';
import { EditDatabaseSpecificDataComponent } from '../../databases/ui/edit/EditDatabaseSpecificDataComponent';

interface Props {
  database: Database;
  backup: Backup;
  workspaceId: string;
}


type DatabaseCredentials = {
  username?: string;
  host?: string;
  port?: number;
  password?: string;
};

const clearCredentials = <T extends DatabaseCredentials>(db: T | undefined): T | undefined => {
  if (!db) return undefined;
  return {
    ...db,
    username: undefined,
    host: undefined,
    port: undefined,
    password: undefined,
  } as T;
};

const createInitialEditingDatabase = (database: Database): Database => ({
  ...database,
  postgresql: clearCredentials(database.postgresql),
  mysql: clearCredentials(database.mysql),
  mariadb: clearCredentials(database.mariadb),
  mongodb: clearCredentials(database.mongodb),
});

const createEmptyDatabaseForManualRestore = (database: Database): Database => {
  const emptyDb = createInitialEditingDatabase(database);
  // Clear database name for all types
  if (emptyDb.postgresql) {
    emptyDb.postgresql.database = undefined;
  }
  if (emptyDb.mysql) {
    emptyDb.mysql.database = undefined;
  }
  if (emptyDb.mariadb) {
    emptyDb.mariadb.database = undefined;
  }
  if (emptyDb.mongodb) {
    emptyDb.mongodb.database = '';
  }
  return emptyDb;
};

const getRestorePayload = (database: Database, editingDatabase: Database) => {
  switch (database.type) {
    case DatabaseType.POSTGRES:
      return { postgresql: editingDatabase.postgresql };
    case DatabaseType.MYSQL:
      return { mysql: editingDatabase.mysql };
    case DatabaseType.MARIADB:
      return { mariadb: editingDatabase.mariadb };
    case DatabaseType.MONGODB:
      return { mongodb: editingDatabase.mongodb };
    default:
      return {};
  }
};

export const RestoresComponent = ({ database, backup, workspaceId }: Props) => {
  const { message } = App.useApp();

  const [editingDatabase, setEditingDatabase] = useState<Database>(
    createInitialEditingDatabase(database),
  );

  const [restores, setRestores] = useState<Restore[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showingRestoreError, setShowingRestoreError] = useState<Restore | undefined>();

  const [isShowRestore, setIsShowRestore] = useState(false);

  // State for database selection
  const [workspaceDatabases, setWorkspaceDatabases] = useState<Database[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | undefined>();
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

  // Credentials for restore (owner/superuser with full privileges)
  const [restoreUsername, setRestoreUsername] = useState('');
  const [restorePassword, setRestorePassword] = useState('');

  const isReloadInProgress = useRef(false);

  const loadRestores = async () => {
    if (isReloadInProgress.current) {
      return;
    }

    isReloadInProgress.current = true;

    try {
      const restores = await restoreApi.getRestores(backup.id);
      setRestores(restores);
    } catch (e) {
      alert((e as Error).message);
    }

    isReloadInProgress.current = false;
  };

  // Helper to get host (without port) from database
  const getServerAddress = (db: Database): string | null => {
    const dbConfig = db.postgresql || db.mysql || db.mariadb || db.mongodb;
    if (dbConfig && 'host' in dbConfig) {
      return dbConfig.host;
    }
    return null;
  };

  // Load workspace databases filtered by same server (host)
  const loadWorkspaceDatabases = useCallback(async () => {
    setIsLoadingDatabases(true);
    try {
      const allDatabases = await databaseApi.getDatabases(workspaceId);
      const sourceHost = getServerAddress(database);

      // Filter to same type and same server (host), exclude current database
      const sameServerDatabases = allDatabases.filter(
        (db) => db.type === database.type &&
          getServerAddress(db) === sourceHost &&
          db.id !== database.id
      );

      setWorkspaceDatabases(sameServerDatabases);
    } catch (e) {
      console.error('Failed to load databases:', e);
    }
    setIsLoadingDatabases(false);
  }, [workspaceId, database]);

  const restore = async (editingDatabase: Database) => {
    try {
      await restoreApi.restoreBackup({
        backupId: backup.id,
        ...getRestorePayload(database, editingDatabase),
      });
      await loadRestores();

      setIsShowRestore(false);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleRestoreToCurrent = async () => {
    try {
      // Restore to current database (targetDatabaseId = database.id)
      await restoreApi.restoreBackup({
        backupId: backup.id,
        targetDatabaseId: database.id,
      });
      await loadRestores();
      setIsShowRestore(false);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadRestores().finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      loadRestores();
    }, 1_000);

    return () => clearInterval(interval);
  }, [backup.id]);

  // Initialize editing database for manual restore mode when modal opens
  useEffect(() => {
    if (isShowRestore) {
      setEditingDatabase(createEmptyDatabaseForManualRestore(database));
      // Load databases for option 2 (same-server restore)
      loadWorkspaceDatabases();
    }
  }, [isShowRestore, database, loadWorkspaceDatabases]);

  const isRestoreInProgress = restores.some(
    (restore) => restore.status === RestoreStatus.IN_PROGRESS,
  );

  if (isShowRestore) {
    // Handle database selection and restore for same-server mode
    const handleSelectDatabase = (databaseId: string) => {
      setSelectedDatabaseId(databaseId);
    };

    const handleRestoreFromSelected = async () => {
      if (!selectedDatabaseId || !restoreUsername || !restorePassword) return;

      try {
        // Send targetDatabaseId with owner credentials for restore
        await restoreApi.restoreBackup({
          backupId: backup.id,
          targetDatabaseId: selectedDatabaseId,
          restoreUsername: restoreUsername,
          restorePassword: restorePassword,
        });
        await loadRestores();
        setIsShowRestore(false);
        // Clear credentials after successful restore
        setRestoreUsername('');
        setRestorePassword('');
        setSelectedDatabaseId(undefined);
      } catch (e) {
        alert((e as Error).message);
      }
    };

    const serverAddress = database.serverName || getServerAddress(database) || 'Unknown server';

    return (
      <div className="space-y-4">
        {/* Option 1: Restore to current database */}
        <div className="rounded border border-gray-300 p-4 dark:border-gray-600">
          <div className="mb-2">
            <strong>1. Restore selected backup to selected database</strong>
          </div>
          <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Database: <strong>{database.name}</strong>
          </div>
          <Button 
            type="primary" 
            onClick={handleRestoreToCurrent}
            disabled={isRestoreInProgress}
          >
            Restore to current database
          </Button>
        </div>

        {/* Option 2: Restore to another database on the same server */}
        <div className="rounded border border-gray-300 p-4 dark:border-gray-600">
          <div className="mb-2">
            <strong>2. Restore selected backup to another database on this server</strong>
          </div>
          <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Server: <strong>{serverAddress}</strong>
          </div>
          
          {isLoadingDatabases ? (
            <div className="flex justify-center py-4">
              <Spin />
            </div>
          ) : workspaceDatabases.length === 0 ? (
            <div className="py-4 text-center text-gray-500">
              No other databases found on the same server
            </div>
          ) : (
            <>
              <Select
                className="w-full mb-4"
                placeholder="Select target database"
                value={selectedDatabaseId}
                onChange={handleSelectDatabase}
                options={workspaceDatabases.map((db) => ({
                  value: db.id,
                  label: db.name,
                }))}
              />

              {selectedDatabaseId && (
                <>
                  <div className="mb-4 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm dark:border-yellow-600 dark:bg-yellow-900/30">
                    <strong>⚠️ Warning:</strong> This will OVERWRITE all data in database "{workspaceDatabases.find((db) => db.id === selectedDatabaseId)?.name}"
                  </div>

                  <div className="mb-4 p-3 rounded border border-blue-300 bg-blue-50 text-sm dark:border-blue-600 dark:bg-blue-900/30">
                    <strong>ℹ️ Note:</strong> Restore requires a user with <strong>full privileges</strong> (database owner or superuser).
                    The read-only backup user cannot perform restore operations.
                  </div>

                  <div className="mb-4 space-y-3">
                    <div>
                      <div className="mb-1 text-sm font-medium">Username (with full privileges):</div>
                      <Input
                        placeholder="e.g. postgres or db_owner"
                        value={restoreUsername}
                        onChange={(e) => setRestoreUsername(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-medium">Password:</div>
                      <Input.Password
                        placeholder="Password"
                        value={restorePassword}
                        onChange={(e) => setRestorePassword(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setIsShowRestore(false)}>Cancel</Button>
                    <Button
                      type="primary"
                      disabled={!selectedDatabaseId || !restoreUsername || !restorePassword}
                      onClick={handleRestoreFromSelected}
                    >
                      Restore to Selected DB
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Option 3: Manual input */}
        <div className="rounded border border-gray-300 p-4 dark:border-gray-600">
          <div className="mb-2">
            <strong>3. Manually restore selected backup, specifying another server and database</strong>
          </div>
          <div className="my-3 text-sm text-gray-600 dark:text-gray-400">
            Enter info of the database we will restore backup to.{' '}
            <u>The empty database for restore should be created before the restore</u>. During the
            restore, all the current data will be cleared.
          </div>

          <EditDatabaseSpecificDataComponent
            database={editingDatabase}
            onCancel={() => setIsShowRestore(false)}
            isShowBackButton={false}
            onBack={() => setIsShowRestore(false)}
            saveButtonText="Restore to this DB"
            isSaveToApi={false}
            onSaved={(database) => {
              setEditingDatabase({ ...database });
              restore(database);
            }}
            isRestoreMode={true}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setIsShowRestore(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {isLoading ? (
        <div className="flex w-full justify-center">
          <Spin />
        </div>
      ) : (
        <>
          <Button
            className="w-full"
            type="primary"
            disabled={isRestoreInProgress}
            loading={isRestoreInProgress}
            onClick={() => {
              setIsShowRestore(true);
            }}
          >
            Restore from backup
          </Button>

          {restores.length === 0 && (
            <div className="my-5 text-center text-gray-400">No restores yet</div>
          )}

          <div className="mt-5">
            {restores.map((restore) => {
              let restoreDurationMs = 0;
              if (restore.status === RestoreStatus.IN_PROGRESS) {
                restoreDurationMs = Date.now() - new Date(restore.createdAt).getTime();
              } else {
                restoreDurationMs = restore.restoreDurationMs;
              }

              const minutes = Math.floor(restoreDurationMs / 60000);
              const seconds = Math.floor((restoreDurationMs % 60000) / 1000);
              const milliseconds = restoreDurationMs % 1000;
              const duration = `${minutes}m ${seconds}s ${milliseconds}ms`;

              const backupDurationMs = backup.backupDurationMs;
              const expectedRestoreDurationMs = backupDurationMs * 5;
              const expectedRestoreDuration = `${Math.floor(expectedRestoreDurationMs / 60000)}m ${Math.floor((expectedRestoreDurationMs % 60000) / 1000)}s`;

              return (
                <div key={restore.id} className="mb-1 rounded border border-gray-200 p-3 text-sm">
                  <div className="mb-1 flex">
                    <div className="w-[75px] min-w-[75px]">Status</div>

                    {restore.status === RestoreStatus.FAILED && (
                      <Tooltip title="Click to see error details">
                        <div
                          className="flex cursor-pointer items-center text-red-600 underline"
                          onClick={() => setShowingRestoreError(restore)}
                        >
                          <ExclamationCircleOutlined
                            className="mr-2"
                            style={{ fontSize: 16, color: '#ff0000' }}
                          />

                          <div>Failed</div>
                        </div>
                      </Tooltip>
                    )}

                    {restore.status === RestoreStatus.COMPLETED && (
                      <div className="flex items-center">
                        <CheckCircleOutlined
                          className="mr-2"
                          style={{ fontSize: 16, color: '#008000' }}
                        />

                        <div>Successful</div>
                      </div>
                    )}

                    {restore.status === RestoreStatus.IN_PROGRESS && (
                      <div className="flex items-center font-bold text-blue-600">
                        <SyncOutlined spin />
                        <span className="ml-2">In progress</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-1 flex">
                    <div className="w-[75px] min-w-[75px]">Started at</div>
                    <div>
                      {dayjs.utc(restore.createdAt).local().format(getUserTimeFormat().format)} (
                      {dayjs.utc(restore.createdAt).local().fromNow()})
                    </div>
                  </div>

                  {restore.status === RestoreStatus.IN_PROGRESS && (
                    <div className="flex">
                      <div className="w-[75px] min-w-[75px]">Duration</div>
                      <div>
                        <div>{duration}</div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Expected restoration time usually 3x-5x longer than the backup duration
                          (sometimes less, sometimes more depending on data type)
                          <br />
                          <br />
                          So it is expected to take up to {expectedRestoreDuration} (usually
                          significantly faster)
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showingRestoreError && (
        <Modal
          title="Restore error details"
          open={!!showingRestoreError}
          onCancel={() => setShowingRestoreError(undefined)}
          maskClosable={false}
          footer={
            <Button
              icon={<CopyOutlined />}
              onClick={() => {
                navigator.clipboard.writeText(showingRestoreError.failMessage || '');
                message.success('Error message copied to clipboard');
              }}
            >
              Copy
            </Button>
          }
        >
          {showingRestoreError.failMessage?.includes('must be owner of extension') && (
            <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-600 dark:bg-yellow-900/30">
              <strong>💡 Tip:</strong> This error typically occurs when restoring to managed
              PostgreSQL services (like Yandex Cloud, AWS RDS or similar). Try enabling{' '}
              <strong>&quot;Exclude extensions&quot;</strong> in Advanced settings before restoring.
            </div>
          )}
          <div className="overflow-y-auto text-sm whitespace-pre-wrap" style={{ height: '400px' }}>
            {showingRestoreError.failMessage}
          </div>
        </Modal>
      )}
    </div>
  );
};
