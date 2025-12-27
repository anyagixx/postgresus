import { Button, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';

import { databaseApi } from '../../../entity/databases';
import type { Database } from '../../../entity/databases';
import type { WorkspaceResponse } from '../../../entity/workspaces';
import { useIsMobile } from '../../../shared/hooks';
import { CreateDatabaseComponent } from './CreateDatabaseComponent';
import { DiscoveryCreateDatabaseComponent } from './create/DiscoveryCreateDatabaseComponent';
import { DatabaseCardComponent } from './DatabaseCardComponent';
import { DatabaseComponent } from './DatabaseComponent';

interface Props {
  contentHeight: number;
  workspace: WorkspaceResponse;
  isCanManageDBs: boolean;
}

const SELECTED_DATABASE_STORAGE_KEY = 'selectedDatabaseId';

export const DatabasesComponent = ({ contentHeight, workspace, isCanManageDBs }: Props) => {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isShowAddDatabase, setIsShowAddDatabase] = useState(false);
  const [isShowDiscovery, setIsShowDiscovery] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | undefined>(undefined);

  const updateSelectedDatabaseId = (databaseId: string | undefined) => {
    setSelectedDatabaseId(databaseId);
    if (databaseId) {
      localStorage.setItem(`${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`, databaseId);
    } else {
      localStorage.removeItem(`${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`);
    }
  };

  const loadDatabases = (isSilent = false, selectDatabaseId?: string) => {
    if (!isSilent) {
      setIsLoading(true);
    }

    databaseApi
      .getDatabases(workspace.id)
      .then((databases) => {
        setDatabases(databases);
        if (selectDatabaseId) {
          updateSelectedDatabaseId(selectDatabaseId);
        } else if (!selectedDatabaseId && !isSilent && !isMobile) {
          // On desktop, auto-select a database; on mobile, keep it unselected to show the list first
          const savedDatabaseId = localStorage.getItem(
            `${SELECTED_DATABASE_STORAGE_KEY}_${workspace.id}`,
          );
          const databaseToSelect =
            savedDatabaseId && databases.some((db) => db.id === savedDatabaseId)
              ? savedDatabaseId
              : databases[0]?.id;
          updateSelectedDatabaseId(databaseToSelect);
        }
      })
      .catch((e) => alert(e.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDatabases();

    const interval = setInterval(() => {
      loadDatabases(true);
    }, 5 * 60_000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-3 my-3 flex w-[250px] justify-center">
        <Spin />
      </div>
    );
  }

  const addDatabaseButton = (
    <div className="mb-2 flex gap-2">
      <Button type="primary" className="flex-1" onClick={() => setIsShowDiscovery(true)}>
        Discover & Add
      </Button>
      <Button type="default" className="flex-1" onClick={() => setIsShowAddDatabase(true)}>
        Add Manually
      </Button>
    </div>
  );

  const filteredDatabases = databases.filter((database) =>
    database.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // On mobile, show either the list or the database details
  const showDatabaseList = !isMobile || !selectedDatabaseId;
  const showDatabaseDetails = selectedDatabaseId && (!isMobile || selectedDatabaseId);

  return (
    <>
      <div className="flex grow">
        {showDatabaseList && (
          <div
            className="w-full overflow-y-auto md:mx-3 md:w-[250px] md:min-w-[250px] md:pr-2"
            style={{ height: contentHeight }}
          >
            {databases.length >= 5 && (
              <>
                {isCanManageDBs && addDatabaseButton}

                <div className="mb-2">
                  <input
                    placeholder="Search database"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border-b border-gray-300 p-1 text-gray-500 outline-none dark:text-gray-400"
                  />
                </div>
              </>
            )}

            {filteredDatabases.length > 0
              ? (() => {
                // Group databases by serverName
                const grouped = filteredDatabases.reduce(
                  (acc, db) => {
                    const key = db.serverName || '__ungrouped__';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(db);
                    return acc;
                  },
                  {} as Record<string, Database[]>,
                );

                // Sort keys: server names first (alphabetically), ungrouped last
                const sortedKeys = Object.keys(grouped).sort((a, b) => {
                  if (a === '__ungrouped__') return 1;
                  if (b === '__ungrouped__') return -1;
                  return a.localeCompare(b);
                });

                return sortedKeys.map((serverName) => (
                  <div key={serverName} className="mb-3">
                    {/* Server header */}
                    <div className="mb-1 flex items-center gap-1 px-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                      <span className="text-base">📦</span>
                      {serverName === '__ungrouped__' ? 'Ungrouped' : serverName}
                      <span className="ml-auto text-[10px] font-normal">
                        {grouped[serverName].length}
                      </span>
                    </div>
                    {/* Databases in this server */}
                    {grouped[serverName].map((database) => (
                      <DatabaseCardComponent
                        key={database.id}
                        database={database}
                        selectedDatabaseId={selectedDatabaseId}
                        setSelectedDatabaseId={updateSelectedDatabaseId}
                      />
                    ))}
                  </div>
                ));
              })()
              : searchQuery && (
                <div className="mb-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No databases found matching &quot;{searchQuery}&quot;
                </div>
              )}

            {databases.length < 5 && isCanManageDBs && addDatabaseButton}

            <div className="mx-3 text-center text-xs text-gray-500 dark:text-gray-400">
              Database - is a thing we are backing up
            </div>
          </div>
        )}

        {showDatabaseDetails && (
          <div className="flex w-full flex-col md:flex-1">
            {isMobile && (
              <div className="mb-2">
                <Button
                  type="default"
                  onClick={() => updateSelectedDatabaseId(undefined)}
                  className="w-full"
                >
                  ← Back to databases
                </Button>
              </div>
            )}

            <DatabaseComponent
              contentHeight={isMobile ? contentHeight - 50 : contentHeight}
              databaseId={selectedDatabaseId}
              workspaceId={workspace.id}
              onDatabaseChanged={() => {
                loadDatabases();
              }}
              onDatabaseDeleted={() => {
                const remainingDatabases = databases.filter(
                  (database) => database.id !== selectedDatabaseId,
                );
                updateSelectedDatabaseId(remainingDatabases[0]?.id);
                loadDatabases();
              }}
              isCanManageDBs={isCanManageDBs}
            />
          </div>
        )}
      </div>

      {isShowAddDatabase && (
        <Modal
          title="Add database for backup"
          footer={<div />}
          open={isShowAddDatabase}
          onCancel={() => setIsShowAddDatabase(false)}
          maskClosable={false}
          width={420}
        >
          <div className="mt-5" />

          <CreateDatabaseComponent
            workspaceId={workspace.id}
            onCreated={(databaseId) => {
              loadDatabases(false, databaseId);
              setIsShowAddDatabase(false);
            }}
            onClose={() => setIsShowAddDatabase(false)}
          />
        </Modal>
      )}

      {isShowDiscovery && (
        <Modal
          title="Discover databases on server"
          footer={<div />}
          open={isShowDiscovery}
          onCancel={() => setIsShowDiscovery(false)}
          maskClosable={false}
          width={520}
        >
          <div className="mt-5" />

          <DiscoveryCreateDatabaseComponent
            workspaceId={workspace.id}
            onCreated={(databaseIds) => {
              if (databaseIds.length > 0) {
                loadDatabases(false, databaseIds[0]);
              }
              setIsShowDiscovery(false);
            }}
            onClose={() => setIsShowDiscovery(false)}
          />
        </Modal>
      )}
    </>
  );
};
