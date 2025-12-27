import { getApplicationServer } from '../../../constants';
import RequestOptions from '../../../shared/api/RequestOptions';
import { apiHelper } from '../../../shared/api/apiHelper';

export interface Server {
    id: string;
    workspaceId: string;
    name: string;
    type: string;
    host: string;
    port: number;
    username: string;
    isHttps: boolean;
}

export interface UpdateServerRequest {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    isHttps?: boolean;
}

export const serverApi = {
    async getServers(workspaceId: string) {
        const requestOptions: RequestOptions = new RequestOptions();
        return apiHelper.fetchGetJson<Server[]>(
            `${getApplicationServer()}/api/v1/workspaces/${workspaceId}/servers`,
            requestOptions,
            true,
        );
    },

    async getServer(workspaceId: string, serverId: string) {
        const requestOptions: RequestOptions = new RequestOptions();
        return apiHelper.fetchGetJson<Server>(
            `${getApplicationServer()}/api/v1/workspaces/${workspaceId}/servers/${serverId}`,
            requestOptions,
            true,
        );
    },

    async updateServer(workspaceId: string, serverId: string, data: UpdateServerRequest) {
        const requestOptions: RequestOptions = new RequestOptions();
        requestOptions.setBody(JSON.stringify(data));
        return apiHelper.fetchPutJson<Server>(
            `${getApplicationServer()}/api/v1/workspaces/${workspaceId}/servers/${serverId}`,
            requestOptions,
        );
    },

    async deleteServer(workspaceId: string, serverId: string) {
        const requestOptions: RequestOptions = new RequestOptions();
        return apiHelper.fetchDeleteRaw(
            `${getApplicationServer()}/api/v1/workspaces/${workspaceId}/servers/${serverId}`,
            requestOptions,
        );
    },

    async renameServer(workspaceId: string, serverId: string, newName: string) {
        return this.updateServer(workspaceId, serverId, { name: newName });
    },
};
