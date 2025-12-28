import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';

import { backupConfigApi } from '../../../entity/backups';
import { type Database, getDatabaseLogoFromType } from '../../../entity/databases';
import { HealthStatus } from '../../../entity/databases/model/HealthStatus';
import type { Storage } from '../../../entity/storages';
import { getStorageLogoFromType } from '../../../entity/storages/models/getStorageLogoFromType';

interface Props {
  database: Database;
  selectedDatabaseId?: string;
  setSelectedDatabaseId: (databaseId: string) => void;
  onDelete?: (database: Database) => void;
  isCanManageDBs?: boolean;
}

export const DatabaseCardComponent = ({
  database,
  selectedDatabaseId,
  setSelectedDatabaseId,
  onDelete,
  isCanManageDBs = false,
}: Props) => {
  const [storage, setStorage] = useState<Storage | undefined>();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!database.id) return;

    backupConfigApi.getBackupConfigByDbID(database.id).then((res) => setStorage(res?.storage));
  }, [database.id]);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(database);
    }
  };

  return (
    <div
      className={`group relative mb-3 cursor-pointer rounded p-3 shadow ${selectedDatabaseId === database.id ? 'bg-blue-100 dark:bg-blue-800' : 'bg-white dark:bg-gray-800'}`}
      onClick={() => setSelectedDatabaseId(database.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex">
        <div className="mb-1 font-bold flex items-center gap-1">
          {database.type && (
            <img
              src={getDatabaseLogoFromType(database.type)}
              alt="databaseIcon"
              className="h-4 w-4"
            />
          )}
          {database.name}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {database.healthStatus && (
            <Tooltip title={database.healthStatus === HealthStatus.AVAILABLE ? 'Available' : 'Unavailable'}>
              <div
                className={`h-3 w-3 rounded-full ${database.healthStatus === HealthStatus.AVAILABLE ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </Tooltip>
          )}

          {isCanManageDBs && onDelete && (
            <Tooltip title="Delete database">
              <button
                onClick={handleDeleteClick}
                className={`rounded p-1 text-gray-400 transition-opacity hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
              >
                <DeleteOutlined className="text-[12px]" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {storage && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>Storage: </span>
          <span className="inline-flex items-center">
            {storage.name}{' '}
            {storage.type && (
              <img
                src={getStorageLogoFromType(storage.type)}
                alt="storageIcon"
                className="ml-1 h-4 w-4"
              />
            )}
          </span>
        </div>
      )}

      {database.lastBackupTime && (
        <div className="text-gray-500 dark:text-gray-400">
          Last backup {dayjs(database.lastBackupTime).fromNow()}
        </div>
      )}

      {database.lastBackupErrorMessage && (
        <div className="mt-1 flex items-center text-sm text-red-600 underline dark:text-red-400">
          <InfoCircleOutlined className="mr-1" style={{ color: 'red' }} />
          Has backup error
        </div>
      )}
    </div>
  );
};
