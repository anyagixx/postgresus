import { DeleteOutlined, RestoreOutlined } from '@ant-design/icons';
import { App, Button, Modal, Spin, Tooltip, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { databaseApi } from '../../../entity/databases';
import type { Database } from '../../../entity/databases';
import { getDatabaseLogoFromType } from '../../../entity/databases';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onRestore?: () => void;
}

export const TrashComponent = ({ workspaceId, onClose, onRestore }: Props): JSX.Element => {
  const { notification } = App.useApp();
  const [isLoading, setIsLoading] = useState(true);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [permanentDeleteModal, setPermanentDeleteModal] = useState<{
    open: boolean;
    database: Database | null;
    confirmName: string;
  }>({
    open: false,
    database: null,
    confirmName: '',
  });

  const loadDeletedDatabases = async () => {
    setIsLoading(true);
    try {
      const deleted = await databaseApi.getDeletedDatabases(workspaceId);
      setDatabases(deleted);
    } catch (error) {
      notification.error({
        message: 'Failed to load deleted databases',
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
  };

  useEffect(() => {
    loadDeletedDatabases();
  }, [workspaceId]);

  const handleRestore = async (database: Database) => {
    setRestoringId(database.id);
    try {
      await databaseApi.restoreDatabase(database.id);
      message.success(`Database "${database.name}" has been restored`);
      await loadDeletedDatabases();
      if (onRestore) {
        onRestore();
      }
    } catch (error) {
      notification.error({
        message: 'Failed to restore database',
        description: (error as Error).message,
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleOpenPermanentDeleteModal = (database: Database) => {
    setPermanentDeleteModal({
      open: true,
      database,
      confirmName: '',
    });
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteModal.database) return;

    const database = permanentDeleteModal.database;

    if (permanentDeleteModal.confirmName !== database.name) {
      notification.error({
        message: 'Confirmation failed',
        description: 'The entered name does not match the database name',
      });
      return;
    }

    setDeletingId(database.id);
    try {
      await databaseApi.permanentDeleteDatabase(database.id);
      message.success(`Database "${database.name}" has been permanently deleted`);
      setPermanentDeleteModal({
        open: false,
        database: null,
        confirmName: '',
      });
      await loadDeletedDatabases();
    } catch (error) {
      notification.error({
        message: 'Failed to permanently delete database',
        description: (error as Error).message,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getDaysUntilPermanentDelete = (deletedAt?: Date): number => {
    if (!deletedAt) return 0;
    const deleted = dayjs(deletedAt);
    const permanentDeleteDate = deleted.add(30, 'days');
    const daysLeft = permanentDeleteDate.diff(dayjs(), 'day');
    return Math.max(0, daysLeft);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold">Trash</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Deleted databases will be permanently removed after 30 days. You can restore them before that.
          </p>
        </div>

        {databases.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400">No deleted databases</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {databases.map((database) => {
              const daysLeft = getDaysUntilPermanentDelete(database.deletedAt);
              const deletedDate = database.deletedAt ? dayjs(database.deletedAt).format('YYYY-MM-DD HH:mm') : '';

              return (
                <div
                  key={database.id}
                  className="rounded border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        {database.type && (
                          <img
                            src={getDatabaseLogoFromType(database.type)}
                            alt="databaseIcon"
                            className="h-5 w-5"
                          />
                        )}
                        <span className="font-semibold">{database.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({database.type})</span>
                      </div>

                      <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                        <div>Deleted: {deletedDate}</div>
                        {daysLeft > 0 ? (
                          <div className="text-orange-600 dark:text-orange-400">
                            Will be permanently deleted in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                          </div>
                        ) : (
                          <div className="text-red-600 dark:text-red-400">Will be deleted soon</div>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <Tooltip title="Restore database">
                        <Button
                          icon={<RestoreOutlined />}
                          onClick={() => handleRestore(database)}
                          loading={restoringId === database.id}
                          disabled={restoringId !== null}
                        >
                          Restore
                        </Button>
                      </Tooltip>
                      <Tooltip title="Permanently delete">
                        <Button
                          icon={<DeleteOutlined />}
                          danger
                          onClick={() => handleOpenPermanentDeleteModal(database)}
                          loading={deletingId === database.id}
                          disabled={deletingId !== null}
                        >
                          Delete
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        title="Permanently Delete Database"
        open={permanentDeleteModal.open}
        onCancel={() =>
          setPermanentDeleteModal({
            open: false,
            database: null,
            confirmName: '',
          })
        }
        footer={[
          <Button
            key="cancel"
            onClick={() =>
              setPermanentDeleteModal({
                open: false,
                database: null,
                confirmName: '',
              })
            }
          >
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deletingId === permanentDeleteModal.database?.id}
            disabled={permanentDeleteModal.confirmName !== (permanentDeleteModal.database?.name || '')}
            onClick={handlePermanentDelete}
          >
            Permanently Delete
          </Button>,
        ]}
        width={500}
      >
        <div className="py-4">
          <div className="mb-4 rounded bg-red-50 p-3 dark:bg-red-900/20">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              ⚠️ Warning: This action cannot be undone!
            </p>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              This will permanently delete the database and all its backups. This action cannot be reversed.
            </p>
          </div>

          <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Database Information:
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Name:</span> {permanentDeleteModal.database?.name}
              </div>
              {permanentDeleteModal.database?.serverName && (
                <div>
                  <span className="font-medium">Server:</span> {permanentDeleteModal.database.serverName}
                </div>
              )}
              <div>
                <span className="font-medium">Type:</span> {permanentDeleteModal.database?.type}
              </div>
            </div>
          </div>

          <div className="mb-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              To confirm permanent deletion, type the database name:
            </label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              value={permanentDeleteModal.confirmName}
              onChange={(e) =>
                setPermanentDeleteModal(prev => ({ ...prev, confirmName: e.target.value }))
              }
              placeholder={permanentDeleteModal.database?.name || 'Database name'}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && permanentDeleteModal.confirmName === permanentDeleteModal.database?.name) {
                  handlePermanentDelete();
                }
              }}
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

