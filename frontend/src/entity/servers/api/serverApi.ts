import { getApplicationServer } from '../../../constants';
import RequestOptions from '../../../shared/api/RequestOptions';
import { apiHelper } from '../../../shared/api/apiHelper';
import type { Server } from '../model/Server';

export const serverApi = {
    async getServers(workspaceId: string): Promise<Server[]> {
        const requestOptions = new RequestOptions();
        return apiHelper.fetchGetJson<Server[]>(
            `${getApplicationServer()}/api/v1/workspaces/${workspaceId}/servers`,
            requestOptions,
            true,
        );
    },
};
