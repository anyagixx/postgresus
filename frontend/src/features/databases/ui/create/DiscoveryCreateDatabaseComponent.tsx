import { Button, Modal } from 'antd';
import { useEffect, useState } from 'react';

import { type BackupConfig, backupConfigApi, backupsApi } from '../../../../entity/backups';
import {
    type Database,
    DatabaseType,
    type DiscoveredDatabase,
    Period,
    type PostgresqlDatabase,
    type MysqlDatabase,
    type MariadbDatabase,
    type MongodbDatabase,
    type ServerConnection,
    databaseApi,
    MysqlVersion,
    MariadbVersion,
    MongodbVersion,
} from '../../../../entity/databases';
import { serverApi, type Server } from '../../../../entity/servers';
import { EditBackupConfigComponent } from '../../../backups';
import { EditDatabaseNotifiersComponent } from '../edit/EditDatabaseNotifiersComponent';
import { DatabaseSelectionComponent } from './DatabaseSelectionComponent';
import { DiscoveryReadOnlyComponent } from './DiscoveryReadOnlyComponent';
import { ServerConnectionComponent } from './ServerConnectionComponent';

interface Props {
    workspaceId: string;
    preselectedServerId?: string;
    onCreated: (databaseIds: string[]) => void;
    onClose: () => void;
}

type Step = 'server-connection' | 'select-databases' | 'readonly-user' | 'backup-config' | 'notifiers';

export const DiscoveryCreateDatabaseComponent = ({ workspaceId, preselectedServerId, onCreated, onClose }: Props) => {
    const [step, setStep] = useState<Step>('server-connection');
    const [isCreating, setIsCreating] = useState(false);
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [createdDatabaseIds, setCreatedDatabaseIds] = useState<string[]>([]);

    // Server connection state
    const [serverConnection, setServerConnection] = useState<ServerConnection | null>(null);
    const [serverName, setServerName] = useState(''); // User-friendly server name
    const [discoveredDatabases, setDiscoveredDatabases] = useState<DiscoveredDatabase[]>([]);
    const [selectedDatabases, setSelectedDatabases] = useState<DiscoveredDatabase[]>([]);
    const [preselectedServer, setPreselectedServer] = useState<Server | null>(null);

    // Backup config state (shared for all databases)
    const [backupConfig, setBackupConfig] = useState<BackupConfig | undefined>();

    // Helper function to create database connection structure based on type
    const createDatabaseConnectionStructure = (
        dbType: DatabaseType,
        connectionData: {
            host: string;
            port: number;
            username: string;
            password: string;
            database: string;
            isHttps: boolean;
        }
    ): Partial<Database> => {
        const baseStructure: Partial<Database> = {
            postgresql: undefined,
            mysql: undefined,
            mariadb: undefined,
            mongodb: undefined,
        };

        switch (dbType) {
            case DatabaseType.MYSQL:
                baseStructure.mysql = {
                    id: undefined as unknown as string,
                    version: MysqlVersion.MysqlVersion80, // Default version, backend will handle actual detection
                    ...connectionData,
                } as MysqlDatabase;
                break;
            case DatabaseType.MARIADB:
                baseStructure.mariadb = {
                    id: undefined as unknown as string,
                    version: MariadbVersion.MariadbVersion106, // Default version, backend will handle actual detection
                    ...connectionData,
                } as MariadbDatabase;
                break;
            case DatabaseType.MONGODB:
                baseStructure.mongodb = {
                    id: undefined as unknown as string,
                    version: MongodbVersion.MongodbVersion70, // Default version, backend will handle actual detection
                    host: connectionData.host,
                    port: connectionData.port,
                    username: connectionData.username,
                    password: connectionData.password,
                    database: connectionData.database,
                    authDatabase: 'admin', // Default auth database for MongoDB
                    isHttps: connectionData.isHttps, // Changed from useTls to isHttps to match backend
                } as MongodbDatabase;
                break;
            case DatabaseType.POSTGRES:
            default:
                baseStructure.postgresql = connectionData as PostgresqlDatabase;
                break;
        }

        return baseStructure;
    };

    // Create a template database for config components
    const createTemplateDatabase = (dbType: DatabaseType = DatabaseType.POSTGRES): Database => {
        const baseDatabase: Database = {
            id: undefined as unknown as string,
            name: 'Template',
            workspaceId,
            storePeriod: Period.MONTH,
            type: dbType,
            notifiers: [],
            sendNotificationsOn: [],
            postgresql: undefined,
            mysql: undefined,
            mariadb: undefined,
            mongodb: undefined,
        } as Database;

        // Initialize appropriate structure based on type
        const connectionStructure = createDatabaseConnectionStructure(dbType, {
            host: '',
            port: 0,
            username: '',
            password: '',
            database: '',
            isHttps: false,
        });

        return { ...baseDatabase, ...connectionStructure } as Database;
    };

    const [templateDatabase, setTemplateDatabase] = useState<Database>(createTemplateDatabase(DatabaseType.POSTGRES));

    // Load preselected server data if serverId is provided
    useEffect(() => {
        if (preselectedServerId) {
            serverApi.getServer(preselectedServerId)
                .then((server) => {
                    setPreselectedServer(server);
                    setServerName(server.name);
                })
                .catch((error) => {
                    console.error('Failed to load server:', error);
                });
        }
    }, [preselectedServerId]);

    const handleServerConnected = (
        connection: ServerConnection,
        databases: DiscoveredDatabase[],
        name: string,
        dbType: DatabaseType,
    ) => {
        setServerConnection(connection);
        setServerName(name);
        setDiscoveredDatabases(databases);
        // Update template database type and structure
        const newTemplateDatabase = createTemplateDatabase(dbType);
        setTemplateDatabase(newTemplateDatabase);
        setStep('select-databases');
    };

    const handleDatabasesSelected = (databases: DiscoveredDatabase[]) => {
        setSelectedDatabases(databases);
        setStep('readonly-user');
    };

    const handleReadOnlyUserCreated = (updatedConnection: ServerConnection) => {
        setServerConnection(updatedConnection);
        setStep('backup-config');
    };

    const handleReadOnlySkipped = () => {
        setStep('backup-config');
    };

    const createAllDatabases = async (databaseWithNotifiers: Database) => {
        if (!serverConnection || selectedDatabases.length === 0) return;

        setIsCreating(true);

        try {
            // Get database type from databaseWithNotifiers or serverConnection
            const dbType = databaseWithNotifiers.type || (serverConnection.databaseType as DatabaseType) || DatabaseType.POSTGRES;

            // Create database configs for each selected database
            // Use databaseWithNotifiers to ensure we have the latest notifiers from the form
            const databasesToCreate: Database[] = selectedDatabases.map((db) => {
                const connectionData = {
                    host: serverConnection.host,
                    port: serverConnection.port,
                    username: serverConnection.username,
                    password: serverConnection.password,
                    database: db.name,
                    isHttps: serverConnection.isHttps,
                };

                const connectionStructure = createDatabaseConnectionStructure(dbType, connectionData);

                return {
                    ...databaseWithNotifiers,
                    name: db.name,
                    type: dbType,
                    ...connectionStructure,
                } as Database;
            });

            // Batch create all databases with server info
            console.log('DEBUG createDatabaseBatch:', { serverConnection, serverName, workspaceId });
            const createdDatabases = await databaseApi.createDatabaseBatch(
                workspaceId,
                databasesToCreate,
                serverConnection,
                serverName,
            );

            // Create backup configs for each database (without running backups yet)
            for (const createdDb of createdDatabases) {
                if (backupConfig) {
                    const dbBackupConfig = { ...backupConfig, databaseId: createdDb.id };
                    await backupConfigApi.saveBackupConfig(dbBackupConfig);
                }
            }

            // Store created database IDs and show modal
            const dbIds = createdDatabases.map((db) => db.id);
            setCreatedDatabaseIds(dbIds);
            setIsCreating(false);
            setShowBackupModal(true);
        } catch (error) {
            alert(error);
            setIsCreating(false);
        }
    };

    const handleBackupNow = async () => {
        // Run backups for all created databases
        for (const dbId of createdDatabaseIds) {
            try {
                await backupsApi.makeBackup(dbId);
            } catch (e) {
                console.error('Failed to backup database', dbId, e);
            }
        }
        setShowBackupModal(false);
        onCreated(createdDatabaseIds);
        onClose();
    };

    const handleSkipBackup = () => {
        setShowBackupModal(false);
        onCreated(createdDatabaseIds);
        onClose();
    };

    // Show backup choice modal when databases are created
    if (showBackupModal) {
        return (
            <Modal
                title="Databases Added Successfully!"
                open={showBackupModal}
                footer={null}
                closable={false}
                width={450}
            >
                <div className="mb-5">
                    <p className="mb-3">
                        <strong>{createdDatabaseIds.length} database{createdDatabaseIds.length !== 1 ? 's' : ''}</strong> have been added successfully.
                    </p>
                    <p>Would you like to create backup copies now?</p>
                </div>

                <div className="flex justify-end gap-2">
                    <Button onClick={handleSkipBackup}>
                        Skip for Now
                    </Button>
                    <Button type="primary" onClick={handleBackupNow}>
                        Backup Now
                    </Button>
                </div>
            </Modal>
        );
    }

    if (step === 'server-connection') {
        return (
            <ServerConnectionComponent
                preselectedServer={preselectedServer}
                preselectedServerName={preselectedServer?.name}
                onConnected={handleServerConnected}
                onCancel={onClose}
            />
        );
    }

    if (step === 'select-databases' && serverConnection) {
        return (
            <DatabaseSelectionComponent
                serverConnection={serverConnection}
                databases={discoveredDatabases}
                onSelected={handleDatabasesSelected}
                onBack={() => setStep('server-connection')}
            />
        );
    }

    if (step === 'readonly-user' && serverConnection) {
        return (
            <DiscoveryReadOnlyComponent
                serverConnection={serverConnection}
                selectedDatabases={selectedDatabases}
                onReadOnlyUserCreated={handleReadOnlyUserCreated}
                onSkip={handleReadOnlySkipped}
                onBack={() => setStep('select-databases')}
            />
        );
    }

    if (step === 'backup-config') {
        return (
            <EditBackupConfigComponent
                database={templateDatabase}
                isShowCancelButton={false}
                onCancel={onClose}
                isShowBackButton
                onBack={() => setStep('select-databases')}
                saveButtonText="Continue"
                isSaveToApi={false}
                onSaved={(config) => {
                    setBackupConfig(config);
                    setStep('notifiers');
                }}
            />
        );
    }

    if (step === 'notifiers') {
        return (
            <EditDatabaseNotifiersComponent
                database={templateDatabase}
                isShowCancelButton={false}
                workspaceId={workspaceId}
                onCancel={onClose}
                isShowBackButton
                onBack={() => setStep('backup-config')}
                isShowSaveOnlyForUnsaved={false}
                saveButtonText={`Add ${selectedDatabases.length} database${selectedDatabases.length !== 1 ? 's' : ''}`}
                isSaveToApi={false}
                onSaved={(database) => {
                    if (isCreating) return;
                    setTemplateDatabase({ ...database });
                    createAllDatabases(database);
                }}
            />
        );
    }

    return null;
};
