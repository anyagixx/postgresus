import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Input, InputNumber, Select, Switch } from 'antd';
import { useState } from 'react';

import {
    type ServerConnection,
    databaseApi,
    type DiscoveredDatabase,
    DatabaseType,
    getDatabaseLogoFromType,
} from '../../../../entity/databases';
import { ConnectionStringParser } from '../../../../entity/databases/model/postgresql/ConnectionStringParser';

interface Props {
    onConnected: (serverConnection: ServerConnection, databases: DiscoveredDatabase[], serverName: string, dbType: DatabaseType) => void;
    onCancel: () => void;
}

export const ServerConnectionComponent = ({ onConnected, onCancel }: Props) => {
    const { message } = App.useApp();

    const [serverName, setServerName] = useState(''); // User-friendly name like "Production Server"
    const [databaseType, setDatabaseType] = useState<DatabaseType>(DatabaseType.POSTGRES);
    const [serverConnection, setServerConnection] = useState<ServerConnection>({
        host: '',
        port: 5432,
        username: '',
        password: '',
        isHttps: false,
    });

    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const databaseTypeOptions = [
        { value: DatabaseType.POSTGRES, label: 'PostgreSQL' },
        { value: DatabaseType.MYSQL, label: 'MySQL' },
        { value: DatabaseType.MARIADB, label: 'MariaDB' },
        { value: DatabaseType.MONGODB, label: 'MongoDB' },
    ];

    const parseFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const trimmedText = text.trim();

            if (!trimmedText) {
                message.error('Clipboard is empty');
                return;
            }

            const result = ConnectionStringParser.parse(trimmedText);

            if ('error' in result) {
                message.error(result.error);
                return;
            }

            setServerConnection({
                host: result.host,
                port: result.port,
                username: result.username,
                password: result.password,
                isHttps: result.isHttps,
            });
            setConnectionError(null);
            message.success('Connection string parsed successfully');
        } catch {
            message.error('Failed to read clipboard. Please check browser permissions.');
        }
    };

    const connectAndDiscover = async () => {
        setIsConnecting(true);
        setConnectionError(null);

        try {
            const response = await databaseApi.discoverDatabases(serverConnection);
            onConnected(serverConnection, response.databases, serverName, databaseType);
        } catch (e) {
            setConnectionError((e as Error).message);
        }

        setIsConnecting(false);
    };

    const isAllFieldsFilled =
        serverName &&
        serverConnection.host &&
        serverConnection.port &&
        serverConnection.username &&
        serverConnection.password;

    return (
        <div>
            <h3 className="mb-4 text-lg font-medium">Connect to {databaseTypeOptions.find(o => o.value === databaseType)?.label} Server</h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Enter your server credentials to discover available databases
            </p>

            <div className="mb-3 flex">
                <div className="min-w-[150px]" />
                <div
                    className="cursor-pointer text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    onClick={parseFromClipboard}
                >
                    <CopyOutlined className="mr-1" />
                    Parse from clipboard
                </div>
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Server Name</div>
                <Input
                    value={serverName}
                    onChange={(e) => {
                        setServerName(e.target.value);
                        setConnectionError(null);
                    }}
                    size="small"
                    className="max-w-[250px] grow"
                    placeholder="e.g. Production Server"
                />
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Database Type</div>
                <div className="flex items-center">
                    <Select
                        value={databaseType}
                        onChange={(value) => {
                            setDatabaseType(value);
                            // Update default port based on type
                            const defaultPorts: Record<DatabaseType, number> = {
                                [DatabaseType.POSTGRES]: 5432,
                                [DatabaseType.MYSQL]: 3306,
                                [DatabaseType.MARIADB]: 3306,
                                [DatabaseType.MONGODB]: 27017,
                            };
                            setServerConnection(prev => ({ ...prev, port: defaultPorts[value] }));
                            setConnectionError(null);
                        }}
                        options={databaseTypeOptions}
                        size="small"
                        className="w-[200px]"
                    />
                    <img
                        src={getDatabaseLogoFromType(databaseType)}
                        alt="databaseIcon"
                        className="ml-2 h-4 w-4"
                    />
                </div>
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Host</div>
                <Input
                    value={serverConnection.host}
                    onChange={(e) => {
                        setServerConnection({
                            ...serverConnection,
                            host: e.target.value.trim().replace('https://', '').replace('http://', ''),
                        });
                        setConnectionError(null);
                    }}
                    size="small"
                    className="max-w-[250px] grow"
                    placeholder="Enter PostgreSQL host"
                />
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Port</div>
                <InputNumber
                    type="number"
                    value={serverConnection.port}
                    onChange={(e) => {
                        if (e === null) return;
                        setServerConnection({ ...serverConnection, port: e });
                        setConnectionError(null);
                    }}
                    size="small"
                    className="max-w-[250px] grow"
                    placeholder="5432"
                />
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Username</div>
                <Input
                    value={serverConnection.username}
                    onChange={(e) => {
                        setServerConnection({ ...serverConnection, username: e.target.value.trim() });
                        setConnectionError(null);
                    }}
                    size="small"
                    className="max-w-[250px] grow"
                    placeholder="Enter username"
                />
            </div>

            <div className="mb-1 flex w-full items-center">
                <div className="min-w-[150px]">Password</div>
                <Input.Password
                    value={serverConnection.password}
                    onChange={(e) => {
                        setServerConnection({ ...serverConnection, password: e.target.value.trim() });
                        setConnectionError(null);
                    }}
                    size="small"
                    className="max-w-[250px] grow"
                    placeholder="Enter password"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    data-form-type="other"
                />
            </div>

            <div className="mb-3 flex w-full items-center">
                <div className="min-w-[150px]">Use SSL</div>
                <Switch
                    checked={serverConnection.isHttps}
                    onChange={(checked) => {
                        setServerConnection({ ...serverConnection, isHttps: checked });
                        setConnectionError(null);
                    }}
                    size="small"
                />
            </div>

            {connectionError && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {connectionError}
                </div>
            )}

            <div className="mt-5 flex">
                <Button className="mr-auto" type="primary" ghost onClick={onCancel}>
                    Cancel
                </Button>

                <Button
                    type="primary"
                    onClick={connectAndDiscover}
                    loading={isConnecting}
                    disabled={!isAllFieldsFilled}
                >
                    Connect & Discover
                </Button>
            </div>
        </div>
    );
};
