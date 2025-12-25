import { Button, Modal } from 'antd';
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
    const [showBackupModal, setShowBackupModal] = useState(false);
    const [createdDatabaseIds, setCreatedDatabaseIds] = useState<string[]>([]);

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

    const createAllDatabases = async (databaseWithNotifiers: Database) => {
        if (!serverConnection || selectedDatabases.length === 0) return;

        setIsCreating(true);

        try {
            // Create database configs for each selected database
            // Use databaseWithNotifiers to ensure we have the latest notifiers from the form
            const databasesToCreate: Database[] = selectedDatabases.map((db) => ({
                ...databaseWithNotifiers,
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
