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
            `${getApplicationServer()}/api/v1/servers?workspace_id=${workspaceId}`,
            requestOptions,
            true,
        );
    },

    async getServer(serverId: string) {
        const requestOptions: RequestOptions = new RequestOptions();
        return apiHelper.fetchGetJson<Server>(
            `${getApplicationServer()}/api/v1/servers/${serverId}`,
            requestOptions,
            true,
        );
    },

    async updateServer(serverId: string, data: UpdateServerRequest) {
        const requestOptions: RequestOptions = new RequestOptions();
        requestOptions.setBody(JSON.stringify(data));
        return apiHelper.fetchPutJson<Server>(
            `${getApplicationServer()}/api/v1/servers/${serverId}`,
            requestOptions,
        );
    },

    async deleteServer(serverId: string) {
        const requestOptions: RequestOptions = new RequestOptions();
        return apiHelper.fetchDeleteRaw(
            `${getApplicationServer()}/api/v1/servers/${serverId}`,
            requestOptions,
        );
    },

    async renameServer(serverId: string, newName: string) {
        return this.updateServer(serverId, { name: newName });
    },
};
