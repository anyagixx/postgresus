import { useState } from 'react';

import { type BackupConfig, backupConfigApi, backupsApi } from '../../../../entity/backups';
import {
    type Database,
    DatabaseType,
    type DiscoveredDatabase,
    Period,
    type PostgresqlDatabase,
    type ServerConnection,
    databaseApi,
} from '../../../../entity/databases';
import { EditBackupConfigComponent } from '../../../backups';
import { EditDatabaseNotifiersComponent } from '../edit/EditDatabaseNotifiersComponent';
import { DatabaseSelectionComponent } from './DatabaseSelectionComponent';
import { DiscoveryReadOnlyComponent } from './DiscoveryReadOnlyComponent';
import { ServerConnectionComponent } from './ServerConnectionComponent';

interface Props {
    workspaceId: string;
    onCreated: (databaseIds: string[]) => void;
    onClose: () => void;
}

type Step = 'server-connection' | 'select-databases' | 'readonly-user' | 'backup-config' | 'notifiers';

export const DiscoveryCreateDatabaseComponent = ({ workspaceId, onCreated, onClose }: Props) => {
    const [step, setStep] = useState<Step>('server-connection');
    const [isCreating, setIsCreating] = useState(false);

    // Server connection state
    const [serverConnection, setServerConnection] = useState<ServerConnection | null>(null);
    const [discoveredDatabases, setDiscoveredDatabases] = useState<DiscoveredDatabase[]>([]);
    const [selectedDatabases, setSelectedDatabases] = useState<DiscoveredDatabase[]>([]);

    // Backup config state (shared for all databases)
    const [backupConfig, setBackupConfig] = useState<BackupConfig | undefined>();

    // Create a template database for config components
    const createTemplateDatabase = (): Database =>
        ({
            id: undefined as unknown as string,
            name: 'Template',
            workspaceId,
            storePeriod: Period.MONTH,
            postgresql: {} as PostgresqlDatabase,
            type: DatabaseType.POSTGRES,
            notifiers: [],
            sendNotificationsOn: [],
        }) as Database;

    const [templateDatabase, setTemplateDatabase] = useState<Database>(createTemplateDatabase());

    const handleServerConnected = (
        connection: ServerConnection,
        databases: DiscoveredDatabase[],
    ) => {
        setServerConnection(connection);
        setDiscoveredDatabases(databases);
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

    const createAllDatabases = async () => {
        if (!serverConnection || selectedDatabases.length === 0) return;

        setIsCreating(true);

        try {
            // Create database configs for each selected database
            const databasesToCreate: Database[] = selectedDatabases.map((db) => ({
                ...templateDatabase,
                name: db.name,
                postgresql: {
                    host: serverConnection.host,
                    port: serverConnection.port,
                    username: serverConnection.username,
                    password: serverConnection.password,
                    database: db.name,
                    isHttps: serverConnection.isHttps,
                } as PostgresqlDatabase,
            }));

            // Batch create all databases
            const createdDatabases = await databaseApi.createDatabaseBatch(workspaceId, databasesToCreate);

            // Create backup configs for each database
            for (const createdDb of createdDatabases) {
                if (backupConfig) {
                    const dbBackupConfig = { ...backupConfig, databaseId: createdDb.id };
                    await backupConfigApi.saveBackupConfig(dbBackupConfig);

                    if (dbBackupConfig.isBackupsEnabled) {
                        await backupsApi.makeBackup(createdDb.id);
                    }
                }
            }

            onCreated(createdDatabases.map((db) => db.id));
            onClose();
        } catch (error) {
            alert(error);
        }

        setIsCreating(false);
    };

    if (step === 'server-connection') {
        return (
            <ServerConnectionComponent
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
                    createAllDatabases();
                }}
            />
        );
    }

    return null;
};
