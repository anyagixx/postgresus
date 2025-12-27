export interface Server {
    id: string;
    workspaceId: string;
    name: string;
    type: string; // postgresql, mysql, mariadb, mongodb
    host: string;
    port: number;
    username: string;
    isHttps: boolean;
    createdAt: string;
    updatedAt: string;
}
