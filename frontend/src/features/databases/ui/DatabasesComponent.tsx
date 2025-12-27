import { CaretDownOutlined, CaretRightOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { Button, Modal, Spin, Tooltip, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

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
const COLLAPSED_GROUPS_STORAGE_KEY = 'collapsedServerGroups';

export const DatabasesComponent = ({ contentHeight, workspace, isCanManageDBs }: Props) => {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isShowAddDatabase, setIsShowAddDatabase] = useState(false);
  const [isShowDiscovery, setIsShowDiscovery] = useState(false);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | undefined>(undefined);

  // Hover state for server groups
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // Collapsed server groups state (stored in localStorage)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`${COLLAPSED_GROUPS_STORAGE_KEY}_${workspace.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleGroupCollapse = useCallback((serverName: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serverName)) {
        newSet.delete(serverName);
      } else {
        newSet.add(serverName);
      }
      localStorage.setItem(
        `${COLLAPSED_GROUPS_STORAGE_KEY}_${workspace.id}`,
        JSON.stringify([...newSet])
      );
      return newSet;
    });
  }, [workspace.id]);

  // Get host:port from first database in group
  const getServerAddress = (databases: Database[]): string | null => {
    const firstDb = databases[0];
    if (!firstDb) return null;

    const dbConfig = firstDb.postgresql || firstDb.mysql || firstDb.mariadb || firstDb.mongodb;
    if (dbConfig && 'host' in dbConfig && 'port' in dbConfig) {
      return `${dbConfig.host}:${dbConfig.port}`;
    }
    return null;
  };

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

            {/* Collapse All / Expand All button */}
            {filteredDatabases.length > 0 && Object.keys(
              filteredDatabases.reduce((acc, db) => {
                const key = db.serverName || '__ungrouped__';
                acc[key] = true;
                return acc;
              }, {} as Record<string, boolean>)
            ).length > 1 && (
                <div className="mb-2 flex justify-end">
                  <button
                    onClick={() => {
                      const allKeys = [...new Set(filteredDatabases.map(db => db.serverName || '__ungrouped__'))];
                      const allCollapsed = allKeys.every(key => collapsedGroups.has(key));

                      if (allCollapsed) {
                        // Expand all
                        setCollapsedGroups(new Set());
                        localStorage.setItem(
                          `${COLLAPSED_GROUPS_STORAGE_KEY}_${workspace.id}`,
                          JSON.stringify([])
                        );
                      } else {
                        // Collapse all
                        setCollapsedGroups(new Set(allKeys));
                        localStorage.setItem(
                          `${COLLAPSED_GROUPS_STORAGE_KEY}_${workspace.id}`,
                          JSON.stringify(allKeys)
                        );
                      }
                    }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {[...new Set(filteredDatabases.map(db => db.serverName || '__ungrouped__'))].every(key => collapsedGroups.has(key))
                      ? '▼ Expand All'
                      : '▲ Collapse All'}
                  </button>
                </div>
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

                return sortedKeys.map((serverName) => {
                  const isCollapsed = collapsedGroups.has(serverName);
                  const displayName = serverName === '__ungrouped__' ? 'Ungrouped' : serverName;
                  const dbCount = grouped[serverName].length;
                  const serverAddress = serverName !== '__ungrouped__' ? getServerAddress(grouped[serverName]) : null;

                  return (
                    <div
                      key={serverName}
                      className="group mb-3"
                      onMouseEnter={() => setHoveredGroup(serverName)}
                      onMouseLeave={() => setHoveredGroup(null)}
                    >
                      {/* Server header - clickable */}
                      <div className="mb-1 flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                        <div
                          className="flex flex-1 cursor-pointer select-none items-center gap-1"
                          onClick={() => toggleGroupCollapse(serverName)}
                        >
                          {isCollapsed ? (
                            <CaretRightOutlined className="text-[10px]" />
                          ) : (
                            <CaretDownOutlined className="text-[10px]" />
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <span className="text-base">📦</span>
                              {displayName}
                            </div>
                            {serverAddress && (
                              <span className="ml-5 text-[9px] font-normal normal-case text-gray-400">
                                {serverAddress}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick action buttons - visible on hover */}
                        {serverName !== '__ungrouped__' && isCanManageDBs && (
                          <div className={`flex items-center gap-0.5 transition-opacity ${hoveredGroup === serverName ? 'opacity-100' : 'opacity-0'}`}>
                            <Tooltip title="Check all connections">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const dbsToCheck = grouped[serverName];
                                  message.loading({ content: `Checking ${dbsToCheck.length} databases...`, key: 'check-connections' });
                                  // Check all databases connections
                                  Promise.all(
                                    dbsToCheck.map(db =>
                                      databaseApi.testDatabaseConnection(db.id)
                                        .then(() => ({ id: db.id, ok: true }))
                                        .catch(() => ({ id: db.id, ok: false }))
                                    )
                                  ).then((results: { id: string; ok: boolean }[]) => {
                                    const ok = results.filter(r => r.ok).length;
                                    const fail = results.filter(r => !r.ok).length;
                                    if (fail === 0) {
                                      message.success({ content: `All ${ok} databases connected!`, key: 'check-connections' });
                                    } else {
                                      message.warning({ content: `${ok} connected, ${fail} failed`, key: 'check-connections' });
                                    }
                                    loadDatabases(true);
                                  });
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-blue-500 dark:hover:bg-gray-700"
                              >
                                <SyncOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                            <Tooltip title="Add database to this server">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsShowDiscovery(true);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-green-500 dark:hover:bg-gray-700"
                              >
                                <PlusOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                            <Tooltip title="Rename server (coming soon)">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  message.info('Rename server feature coming soon!');
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-orange-500 dark:hover:bg-gray-700"
                              >
                                <EditOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                          </div>
                        )}

                        <span className="ml-auto text-[10px] font-normal">
                          {dbCount}
                        </span>
                      </div>
                      {/* Databases in this server - collapsible with animation */}
                      <div
                        className={`overflow-hidden transition-all duration-200 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100'
                          }`}
                      >
                        {grouped[serverName].map((database) => (
                          <DatabaseCardComponent
                            key={database.id}
                            database={database}
                            selectedDatabaseId={selectedDatabaseId}
                            setSelectedDatabaseId={updateSelectedDatabaseId}
                          />
                        ))}
                      </div>
                    </div>
                  );
                });
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
