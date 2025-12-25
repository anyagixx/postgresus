import { Button, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';

import {
    type Database,
    DatabaseType,
    type DiscoveredDatabase,
    type PostgresqlDatabase,
    type ServerConnection,
    databaseApi,
} from '../../../../entity/databases';

interface Props {
    serverConnection: ServerConnection;
    selectedDatabases: DiscoveredDatabase[];
    onReadOnlyUserCreated: (updatedConnection: ServerConnection) => void;
    onSkip: () => void;
    onBack: () => void;
}

export const DiscoveryReadOnlyComponent = ({
    serverConnection,
    selectedDatabases,
    onReadOnlyUserCreated,
    onSkip,
    onBack,
}: Props) => {
    const [isCheckingReadOnlyUser, setIsCheckingReadOnlyUser] = useState(false);
    const [isCreatingReadOnlyUser, setIsCreatingReadOnlyUser] = useState(false);
    const [isShowSkipConfirmation, setShowSkipConfirmation] = useState(false);
    const [isAlreadyReadOnly, setIsAlreadyReadOnly] = useState(false);

    // Create a temporary database object to use with the existing API
    // Note: We don't set id or workspaceId - the backend handles this case
    // by using the database object directly without looking up from DB
    const createTempDatabase = (): Database => {
        const firstDb = selectedDatabases[0];
        return {
            name: firstDb.name,
            type: DatabaseType.POSTGRES,
            postgresql: {
                host: serverConnection.host,
                port: serverConnection.port,
                username: serverConnection.username,
                password: serverConnection.password,
                database: firstDb.name,
                isHttps: serverConnection.isHttps,
            } as PostgresqlDatabase,
        } as Database;
    };

    const checkReadOnlyUser = async (): Promise<boolean> => {
        try {
            const tempDatabase = createTempDatabase();
            const response = await databaseApi.isUserReadOnly(tempDatabase);
            return response.isReadOnly;
        } catch {
            // If check fails, assume not read-only and let user decide
            return false;
        }
    };

    const createReadOnlyUser = async () => {
        setIsCreatingReadOnlyUser(true);

        try {
            const tempDatabase = createTempDatabase();
            const response = await databaseApi.createReadOnlyUser(tempDatabase);

            // Grant access to all selected databases (not just the first one)
            if (selectedDatabases.length > 1) {
                const grantResponse = await databaseApi.grantReadOnlyAccess({
                    username: response.username,
                    host: serverConnection.host,
                    port: serverConnection.port,
                    adminUsername: serverConnection.username,
                    adminPassword: serverConnection.password,
                    isHttps: serverConnection.isHttps,
                    databases: selectedDatabases.slice(1).map(db => db.name), // Skip first, already has access
                });

                if (grantResponse.failedDatabases && grantResponse.failedDatabases.length > 0) {
                    console.warn('Failed to grant access to some databases:', grantResponse.failedDatabases);
                }
            }

            // Update server connection with new credentials
            const updatedConnection: ServerConnection = {
                ...serverConnection,
                username: response.username,
                password: response.password,
            };

            onReadOnlyUserCreated(updatedConnection);
        } catch (e) {
            alert((e as Error).message);
        }

        setIsCreatingReadOnlyUser(false);
    };

    const handleSkip = () => {
        setShowSkipConfirmation(true);
    };

    const handleSkipConfirmed = () => {
        setShowSkipConfirmation(false);
        onSkip();
    };

    useEffect(() => {
        const run = async () => {
            setIsCheckingReadOnlyUser(true);

            const isReadOnly = await checkReadOnlyUser();
            if (isReadOnly) {
                setIsAlreadyReadOnly(true);
                // Auto-continue if already read-only
                onSkip();
            }

            setIsCheckingReadOnlyUser(false);
        };
        run();
    }, []);

    if (isCheckingReadOnlyUser) {
        return (
            <div className="flex items-center">
                <Spin />
                <span className="ml-3">Checking user permissions...</span>
            </div>
        );
    }

    if (isAlreadyReadOnly) {
        return (
            <div className="flex items-center">
                <Spin />
                <span className="ml-3">User is already read-only, continuing...</span>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-5">
                <p className="mb-3 text-lg font-bold">Create a read-only user for Postgresus?</p>

                <p className="mb-2">
                    You are about to add <strong>{selectedDatabases.length} database{selectedDatabases.length !== 1 ? 's' : ''}</strong>.
                    A read-only user will be created for secure backup operations.
                </p>

                <p className="mb-2">
                    A read-only user is a PostgreSQL user with limited permissions that can only read
                    data from your database, not modify it. This is recommended because:
                </p>

                <ul className="mb-2 ml-5 list-disc">
                    <li>it prevents accidental data modifications during backup</li>
                    <li>it follows the principle of least privilege</li>
                    <li>it&apos;s a security best practice</li>
                </ul>

                <p className="mb-2">
                    Postgresus enforces enterprise-grade security (
                    <a
                        href="https://postgresus.com/security"
                        target="_blank"
                        rel="noreferrer"
                        className="!text-blue-600 dark:!text-blue-400"
                    >
                        read in details here
                    </a>
                    ). However, it is not possible to be covered from all possible risks.
                </p>

                <p className="mt-3">
                    <b>Read-only user allows to avoid storing credentials with write access at all</b>. Even
                    in the worst case of hacking, nobody will be able to corrupt your data.
                </p>
            </div>

            <div className="mt-5 flex">
                <Button className="mr-auto" type="primary" ghost onClick={onBack}>
                    Back
                </Button>

                <Button className="mr-2 ml-auto" danger ghost onClick={handleSkip}>
                    Skip
                </Button>

                <Button
                    type="primary"
                    onClick={createReadOnlyUser}
                    loading={isCreatingReadOnlyUser}
                    disabled={isCreatingReadOnlyUser}
                >
                    Yes, create read-only user
                </Button>
            </div>

            <Modal
                title="Skip read-only user creation?"
                open={isShowSkipConfirmation}
                onCancel={() => setShowSkipConfirmation(false)}
                footer={null}
                width={450}
            >
                <div className="mb-5">
                    <p className="mb-2">Are you sure you want to skip creating a read-only user?</p>

                    <p className="mb-2">
                        Using a user with full permissions for backups is not recommended and may pose security
                        risks. Postgresus is highly recommending you to not skip this step.
                    </p>

                    <p>
                        100% protection is never possible. It&apos;s better to be safe in case of 0.01% risk of
                        full hacking. So it is better to follow the secure way with read-only user.
                    </p>
                </div>

                <div className="flex justify-end">
                    <Button className="mr-2" danger onClick={handleSkipConfirmed}>
                        Yes, I accept risks
                    </Button>

                    <Button type="primary" onClick={() => setShowSkipConfirmation(false)}>
                        Let&apos;s continue with the secure way
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
