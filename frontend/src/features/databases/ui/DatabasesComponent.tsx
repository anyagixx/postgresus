import { CaretDownOutlined, CaretRightOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { App, Button, Input, Modal, Spin, Tabs, Tooltip, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { databaseApi } from '../../../entity/databases';
import type { Database } from '../../../entity/databases';
import { serverApi } from '../../../entity/servers';
import type { WorkspaceResponse } from '../../../entity/workspaces';
import { useIsMobile } from '../../../shared/hooks';
import { DiscoveryCreateDatabaseComponent } from './create/DiscoveryCreateDatabaseComponent';
import { DatabaseCardComponent } from './DatabaseCardComponent';
import { DatabaseComponent } from './DatabaseComponent';
import { TrashComponent } from './TrashComponent';

interface Props {
  contentHeight: number;
  workspace: WorkspaceResponse;
  isCanManageDBs: boolean;
}

const SELECTED_DATABASE_STORAGE_KEY = 'selectedDatabaseId';
const COLLAPSED_GROUPS_STORAGE_KEY = 'collapsedServerGroups';

export const DatabasesComponent = ({ contentHeight, workspace, isCanManageDBs }: Props) => {
  const { notification } = App.useApp();
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(true);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isShowDiscovery, setIsShowDiscovery] = useState(false);
  const [preselectedServerId, setPreselectedServerId] = useState<string | null>(null);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | undefined>(undefined);

  // Hover state for server groups
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // Rename server modal state
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    serverId: string | null;
    currentName: string;
    newName: string;
    loading: boolean;
  }>({
    open: false,
    serverId: null,
    currentName: '',
    newName: '',
    loading: false,
  });

  // Delete server modal state
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    serverId: string | null;
    serverName: string;
    linkedDatabases: Database[];
    loading: boolean;
    loadingDatabases: boolean;
    confirmName: string;
  }>({
    open: false,
    serverId: null,
    serverName: '',
    linkedDatabases: [],
    loading: false,
    loadingDatabases: false,
    confirmName: '',
  });

  // Delete database modal state
  const [deleteDatabaseModal, setDeleteDatabaseModal] = useState<{
    open: boolean;
    database: Database | null;
    confirmName: string;
    loading: boolean;
  }>({
    open: false,
    database: null,
    confirmName: '',
    loading: false,
  });

  const [activeTab, setActiveTab] = useState<string>('databases');
  const [trashRefreshKey, setTrashRefreshKey] = useState<number>(0);

  const handleRenameServer = async () => {
    if (!renameModal.serverId || !renameModal.newName.trim()) return;

    setRenameModal(prev => ({ ...prev, loading: true }));
    try {
      await serverApi.renameServer(renameModal.serverId, renameModal.newName.trim());
      message.success('Server renamed successfully!');
      setRenameModal({ open: false, serverId: null, currentName: '', newName: '', loading: false });
      loadDatabases(true); // Reload to get updated server names
    } catch (error) {
      message.error('Failed to rename server');
      setRenameModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenDeleteModal = async (serverId: string, serverName: string) => {
    setDeleteModal({
      open: true,
      serverId,
      serverName,
      linkedDatabases: [],
      loading: false,
      loadingDatabases: true,
      confirmName: '',
    });

    try {
      const linkedDatabases = await serverApi.getLinkedDatabases(serverId);
      setDeleteModal(prev => ({
        ...prev,
        linkedDatabases,
        loadingDatabases: false,
      }));
    } catch (error) {
      notification.error({
        message: 'Error loading linked databases',
        description: (error as Error).message || 'Failed to load databases linked to this server',
      });
      setDeleteModal(prev => ({
        ...prev,
        loadingDatabases: false,
      }));
    }
  };

  const handleDeleteServer = async () => {
    if (!deleteModal.serverId) return;
    
    if (deleteModal.confirmName !== deleteModal.serverName) {
      notification.error({
        message: 'Server name does not match',
        description: 'Please type the server name exactly to confirm deletion',
      });
      return;
    }

    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await serverApi.deleteServer(deleteModal.serverId);
      
      notification.success({
        message: 'Server deleted',
        description: deleteModal.linkedDatabases.length > 0 
          ? `Server and ${deleteModal.linkedDatabases.length} database(s) have been moved to Trash`
          : 'Server has been deleted',
      });

      setDeleteModal({
        open: false,
        serverId: null,
        serverName: '',
        linkedDatabases: [],
        loading: false,
        loadingDatabases: false,
        confirmName: '',
      });
      loadDatabases(true);
      // Обновляем корзину, чтобы удаленные базы сразу появились
      setTrashRefreshKey(prev => prev + 1);
    } catch (error) {
      notification.error({
        message: 'Failed to delete server',
        description: (error as Error).message || 'Unknown error occurred',
      });
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleOpenDeleteDatabaseModal = (database: Database) => {
    setDeleteDatabaseModal({
      open: true,
      database,
      confirmName: '',
      loading: false,
    });
  };

  const handleDeleteDatabase = async () => {
    if (!deleteDatabaseModal.database) return;

    const database = deleteDatabaseModal.database;
    
    // Validate confirmation name
    if (deleteDatabaseModal.confirmName !== database.name) {
      notification.error({
        message: 'Confirmation failed',
        description: 'The entered name does not match the database name',
      });
      return;
    }

    setDeleteDatabaseModal(prev => ({ ...prev, loading: true }));
    try {
      await databaseApi.deleteDatabase(database.id);
      notification.success({
        message: 'Database deleted',
        description: `Database "${database.name}" has been deleted successfully`,
      });
      setDeleteDatabaseModal({
        open: false,
        database: null,
        confirmName: '',
        loading: false,
      });
      
      // If deleted database was selected, clear selection
      if (selectedDatabaseId === database.id) {
        updateSelectedDatabaseId('');
      }
      
      loadDatabases(true);
      // Обновляем корзину, чтобы удаленная база сразу появилась
      setTrashRefreshKey(prev => prev + 1);
    } catch (error) {
      notification.error({
        message: 'Failed to delete database',
        description: (error as Error).message || 'Unknown error occurred',
      });
      setDeleteDatabaseModal(prev => ({ ...prev, loading: false }));
    }
  };

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

  // Get host from first database in group
  const getServerAddress = (databases: Database[]): string | null => {
    const firstDb = databases[0];
    if (!firstDb) return null;

    const dbConfig = firstDb.postgresql || firstDb.mysql || firstDb.mariadb || firstDb.mongodb;
    if (dbConfig && 'host' in dbConfig) {
      return dbConfig.host;
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

  // More frequent update interval for healthcheck status (60 seconds)
  useEffect(() => {
    const healthcheckInterval = setInterval(() => {
      loadDatabases(true);
    }, 60_000);

    return () => clearInterval(healthcheckInterval);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-3 my-3 flex w-[250px] justify-center">
        <Spin />
      </div>
    );
  }

  const addDatabaseButton = (
    <div className="mb-2">
      <Button
        type="primary"
        className="w-full"
        onClick={() => {
          setPreselectedServerId(null);
          setIsShowDiscovery(true);
        }}
      >
        Discover & Add
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
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'databases',
                  label: 'Databases',
                  children: (
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
                              <span className="text-base">🖥</span>
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
                                  const totalCount = dbsToCheck.length;
                                  
                                  if (totalCount === 0) {
                                    return;
                                  }
                                  
                                  notification.info({
                                    message: 'Checking connections...',
                                    description: `Testing ${totalCount} databases`,
                                    key: 'check-connections',
                                    duration: 0
                                  });
                                  
                                  // Check all databases connections
                                  Promise.allSettled(
                                    dbsToCheck.map(db =>
                                      databaseApi.testDatabaseConnection(db.id)
                                        .then(() => ({ id: db.id, name: db.name, ok: true, error: null }))
                                        .catch((error: Error) => ({ 
                                          id: db.id, 
                                          name: db.name, 
                                          ok: false, 
                                          error: error.message || 'Connection failed' 
                                        }))
                                    )
                                  ).then((settledResults) => {
                                    const results: { id: string; name: string; ok: boolean; error: string | null }[] = 
                                      settledResults.map(result => 
                                        result.status === 'fulfilled' 
                                          ? result.value 
                                          : { id: '', name: 'Unknown', ok: false, error: 'Unexpected error' }
                                      );
                                    
                                    const okResults = results.filter(r => r.ok);
                                    const failResults = results.filter(r => !r.ok);

                                    if (failResults.length === 0) {
                                      notification.success({
                                        message: 'All Connected! ✅',
                                        description: `All ${okResults.length} databases connected successfully`,
                                        key: 'check-connections',
                                        duration: 5
                                      });
                                    } else if (okResults.length === 0) {
                                      const errorDetails = failResults
                                        .map(r => `${r.name}: ${r.error || 'Connection failed'}`)
                                        .join('; ');
                                      notification.error({
                                        message: 'Connection Failed ❌',
                                        description: `All ${failResults.length} databases failed to connect. ${errorDetails}`,
                                        key: 'check-connections',
                                        duration: 15
                                      });
                                    } else {
                                      const failedDetails = failResults
                                        .map(r => `${r.name}: ${r.error || 'Connection failed'}`)
                                        .join('; ');
                                      notification.warning({
                                        message: `Partial Success ⚠️`,
                                        description: `${okResults.length} connected, ${failResults.length} failed. Failed: ${failedDetails}`,
                                        key: 'check-connections',
                                        duration: 15
                                      });
                                    }
                                    loadDatabases(true);
                                  }).catch((error) => {
                                    notification.error({
                                      message: 'Error checking connections ❌',
                                      description: `Failed to check connections: ${error.message || 'Unknown error'}`,
                                      key: 'check-connections',
                                      duration: 10
                                    });
                                    loadDatabases(true);
                                  });
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-green-500 dark:hover:bg-gray-700"
                              >
                                <SyncOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                            <Tooltip title="Add database to this server">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstDb = grouped[serverName][0];
                                  if (firstDb?.serverId) {
                                    setPreselectedServerId(firstDb.serverId);
                                  }
                                  setIsShowDiscovery(true);
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-blue-500 dark:hover:bg-gray-700"
                              >
                                <PlusOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                            <Tooltip title="Rename server">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstDb = grouped[serverName][0];
                                  if (firstDb?.serverId) {
                                    setRenameModal({
                                      open: true,
                                      serverId: firstDb.serverId,
                                      currentName: displayName,
                                      newName: displayName,
                                      loading: false,
                                    });
                                  } else {
                                    message.warning('Cannot rename: server ID not found');
                                  }
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-orange-500 dark:hover:bg-gray-700"
                              >
                                <EditOutlined className="text-[10px]" />
                              </button>
                            </Tooltip>
                            <Tooltip title="Delete server">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstDb = grouped[serverName][0];
                                  if (firstDb?.serverId) {
                                    handleOpenDeleteModal(firstDb.serverId, displayName);
                                  } else {
                                    message.warning('Cannot delete: server ID not found');
                                  }
                                }}
                                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700"
                              >
                                <DeleteOutlined className="text-[10px]" />
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
                            onDelete={handleOpenDeleteDatabaseModal}
                            isCanManageDBs={isCanManageDBs}
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

            <div className="mx-3 text-center text-xs text-gray-500 dark:text-gray-400">
              Database - is a thing we are backing up
            </div>
                    </>
                  ),
                },
                {
                  key: 'trash',
                  label: 'Trash',
                  children: (
                    <TrashComponent
                      workspaceId={workspace.id}
                      onClose={() => setActiveTab('databases')}
                      onRestore={() => {
                        loadDatabases(true);
                        setActiveTab('databases');
                      }}
                      refreshKey={trashRefreshKey}
                    />
                  ),
                },
              ]}
            />
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
            preselectedServerId={preselectedServerId || undefined}
            onCreated={(databaseIds) => {
              if (databaseIds.length > 0) {
                loadDatabases(false, databaseIds[0]);
              }
              setIsShowDiscovery(false);
              setPreselectedServerId(null);
            }}
            onClose={() => {
              setIsShowDiscovery(false);
              setPreselectedServerId(null);
            }}
          />
        </Modal>
      )}

      {/* Rename Server Modal */}
      <Modal
        title={`Rename Server: ${renameModal.currentName}`}
        open={renameModal.open}
        onCancel={() => setRenameModal({ open: false, serverId: null, currentName: '', newName: '', loading: false })}
        footer={[
          <Button
            key="cancel"
            onClick={() => setRenameModal({ open: false, serverId: null, currentName: '', newName: '', loading: false })}
          >
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={renameModal.loading}
            disabled={!renameModal.newName.trim() || renameModal.newName === renameModal.currentName}
            onClick={handleRenameServer}
          >
            Save
          </Button>,
        ]}
        width={400}
      >
        <div className="py-4">
          <label className="mb-2 block text-sm text-gray-500">New server name:</label>
          <Input
            value={renameModal.newName}
            onChange={(e) => setRenameModal(prev => ({ ...prev, newName: e.target.value }))}
            placeholder="Enter new server name"
            onPressEnter={() => {
              if (renameModal.newName.trim() && renameModal.newName !== renameModal.currentName) {
                handleRenameServer();
              }
            }}
          />
        </div>
      </Modal>

      {/* Delete Server Modal */}
      <Modal
        title={`Delete Server: ${deleteModal.serverName}`}
        open={deleteModal.open}
        onCancel={() => setDeleteModal({
          open: false,
          serverId: null,
          serverName: '',
          linkedDatabases: [],
          loading: false,
          loadingDatabases: false,
          confirmName: '',
        })}
        footer={[
          <Button
            key="cancel"
            onClick={() => setDeleteModal({
              open: false,
              serverId: null,
              serverName: '',
              linkedDatabases: [],
              loading: false,
              loadingDatabases: false,
              confirmName: '',
            })}
          >
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deleteModal.loading}
            disabled={deleteModal.loadingDatabases || (deleteModal.linkedDatabases.length > 0 && deleteModal.confirmName !== deleteModal.serverName)}
            onClick={handleDeleteServer}
          >
            Delete Server
          </Button>,
        ]}
        width={600}
      >
        <div className="py-4">
          {deleteModal.loadingDatabases ? (
            <div className="flex justify-center py-8">
              <Spin size="large" />
            </div>
          ) : deleteModal.linkedDatabases.length > 0 ? (
            <>
              <div className="mb-4 rounded bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ Warning: This server has {deleteModal.linkedDatabases.length} linked database{deleteModal.linkedDatabases.length !== 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                  All databases will be moved to Trash and can be restored within 30 days.
                </p>
              </div>

              <div className="mb-4 rounded bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
                  Deleting this server will:
                </p>
                <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>Permanently delete the server (this action cannot be undone)</li>
                  <li>Move all {deleteModal.linkedDatabases.length} linked database{deleteModal.linkedDatabases.length !== 1 ? 's' : ''} to Trash</li>
                </ul>
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  Note: Databases moved to Trash can be restored within 30 days. After 30 days, they will be permanently deleted.
                </p>
              </div>

              <div className="mt-4 max-h-60 overflow-y-auto rounded border border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Linked Databases ({deleteModal.linkedDatabases.length}):
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {deleteModal.linkedDatabases.map((db) => (
                    <div key={db.id} className="px-3 py-2 text-sm">
                      <div className="font-medium">{db.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{db.type}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  To confirm deletion, type the server name:
                </label>
                <Input
                  value={deleteModal.confirmName}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, confirmName: e.target.value }))}
                  placeholder={deleteModal.serverName}
                  onPressEnter={() => {
                    if (deleteModal.confirmName === deleteModal.serverName) {
                      handleDeleteServer();
                    }
                  }}
                  autoFocus
                />
              </div>
            </>
          ) : (
            <div className="py-4">
              <div className="mb-4 rounded bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                  ⚠️ Warning: This action cannot be undone!
                </p>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This server has no linked databases. The server will be deleted permanently.
              </p>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  To confirm deletion, type the server name:
                </label>
                <Input
                  value={deleteModal.confirmName}
                  onChange={(e) => setDeleteModal(prev => ({ ...prev, confirmName: e.target.value }))}
                  placeholder={deleteModal.serverName}
                  onPressEnter={() => {
                    if (deleteModal.confirmName === deleteModal.serverName) {
                      handleDeleteServer();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Database Modal */}
      <Modal
        title="Delete Database"
        open={deleteDatabaseModal.open}
        onCancel={() => setDeleteDatabaseModal({
          open: false,
          database: null,
          confirmName: '',
          loading: false,
        })}
        footer={[
          <Button
            key="cancel"
            onClick={() => setDeleteDatabaseModal({
              open: false,
              database: null,
              confirmName: '',
              loading: false,
            })}
          >
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deleteDatabaseModal.loading}
            disabled={deleteDatabaseModal.confirmName !== (deleteDatabaseModal.database?.name || '')}
            onClick={handleDeleteDatabase}
          >
            Delete Database
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
              This will move the database to trash. It will be automatically deleted after 30 days. You can restore it from the trash before that.
            </p>
          </div>

          <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Database Information:
            </div>
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Name:</span> {deleteDatabaseModal.database?.name}
              </div>
              {deleteDatabaseModal.database?.serverName && (
                <div>
                  <span className="font-medium">Server:</span> {deleteDatabaseModal.database.serverName}
                </div>
              )}
              <div>
                <span className="font-medium">Type:</span> {deleteDatabaseModal.database?.type}
              </div>
            </div>
          </div>

          <div className="mb-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              To confirm deletion, type the database name:
            </label>
            <Input
              value={deleteDatabaseModal.confirmName}
              onChange={(e) => setDeleteDatabaseModal(prev => ({ ...prev, confirmName: e.target.value }))}
              placeholder={deleteDatabaseModal.database?.name || 'Database name'}
              onPressEnter={() => {
                if (deleteDatabaseModal.confirmName === deleteDatabaseModal.database?.name) {
                  handleDeleteDatabase();
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
