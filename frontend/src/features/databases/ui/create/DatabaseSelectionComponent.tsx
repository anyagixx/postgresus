import { Button, Checkbox, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';

import type { DiscoveredDatabase, ServerConnection } from '../../../../entity/databases';

interface Props {
    serverConnection: ServerConnection;
    databases: DiscoveredDatabase[];
    onSelected: (selectedDatabases: DiscoveredDatabase[]) => void;
    onBack: () => void;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const DatabaseSelectionComponent = ({
    serverConnection,
    databases,
    onSelected,
    onBack,
}: Props) => {
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

    const columns: ColumnsType<DiscoveredDatabase> = [
        {
            title: 'Database Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => <span className="font-medium">{name}</span>,
        },
        {
            title: 'Size',
            dataIndex: 'size',
            key: 'size',
            render: (size: number) => formatBytes(size),
            width: 120,
        },
        {
            title: 'Owner',
            dataIndex: 'owner',
            key: 'owner',
            width: 150,
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
    };

    const selectAll = () => {
        setSelectedRowKeys(databases.map((db) => db.name));
    };

    const deselectAll = () => {
        setSelectedRowKeys([]);
    };

    const handleContinue = () => {
        const selected = databases.filter((db) => selectedRowKeys.includes(db.name));
        onSelected(selected);
    };

    const allSelected = selectedRowKeys.length === databases.length;

    return (
        <div>
            <h3 className="mb-2 text-lg font-medium">Select Databases for Backup</h3>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                Connected to <span className="font-medium">{serverConnection.host}</span>. Found{' '}
                <span className="font-medium">{databases.length}</span> database
                {databases.length !== 1 ? 's' : ''}.
            </p>

            <div className="mb-3 flex items-center gap-3">
                <Checkbox
                    checked={allSelected && databases.length > 0}
                    indeterminate={selectedRowKeys.length > 0 && !allSelected}
                    onChange={() => (allSelected ? deselectAll() : selectAll())}
                >
                    Select All
                </Checkbox>

                {selectedRowKeys.length > 0 && (
                    <span className="text-sm text-gray-500">
                        {selectedRowKeys.length} database{selectedRowKeys.length !== 1 ? 's' : ''} selected
                    </span>
                )}
            </div>

            <Table
                rowSelection={rowSelection}
                columns={columns}
                dataSource={databases}
                rowKey="name"
                size="small"
                pagination={databases.length > 10 ? { pageSize: 10 } : false}
                className="mb-4"
            />

            <div className="mt-5 flex">
                <Button className="mr-auto" type="primary" ghost onClick={onBack}>
                    Back
                </Button>

                <Button type="primary" onClick={handleContinue} disabled={selectedRowKeys.length === 0}>
                    Continue with {selectedRowKeys.length} database{selectedRowKeys.length !== 1 ? 's' : ''}
                </Button>
            </div>
        </div>
    );
};
