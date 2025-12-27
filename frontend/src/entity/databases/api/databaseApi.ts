import { getApplicationServer } from '../../../constants';
import RequestOptions from '../../../shared/api/RequestOptions';
import { apiHelper } from '../../../shared/api/apiHelper';
import type { CreateReadOnlyUserResponse } from '../model/CreateReadOnlyUserResponse';
import type { Database } from '../model/Database';
import type { IsReadOnlyResponse } from '../model/IsReadOnlyResponse';

export const databaseApi = {
  async createDatabase(database: Database) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(database));
    return apiHelper.fetchPostJson<Database>(
      `${getApplicationServer()}/api/v1/databases/create`,
      requestOptions,
    );
  },

  async updateDatabase(database: Database) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(database));
    return apiHelper.fetchPostJson<Database>(
      `${getApplicationServer()}/api/v1/databases/update`,
      requestOptions,
    );
  },

  async getDatabase(id: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper.fetchGetJson<Database>(
      `${getApplicationServer()}/api/v1/databases/${id}`,
      requestOptions,
      true,
    );
  },

  async getDatabases(workspaceId: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper.fetchGetJson<Database[]>(
      `${getApplicationServer()}/api/v1/databases?workspace_id=${workspaceId}`,
      requestOptions,
      true,
    );
  },

  async deleteDatabase(id: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper.fetchDeleteRaw(
      `${getApplicationServer()}/api/v1/databases/${id}`,
      requestOptions,
    );
  },

  async copyDatabase(id: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper.fetchPostJson<Database>(
      `${getApplicationServer()}/api/v1/databases/${id}/copy`,
      requestOptions,
    );
  },

  async testDatabaseConnection(id: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper.fetchPostJson(
      `${getApplicationServer()}/api/v1/databases/${id}/test-connection`,
      requestOptions,
    );
  },

  async testDatabaseConnectionDirect(database: Database) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(database));
    return apiHelper.fetchPostJson(
      `${getApplicationServer()}/api/v1/databases/test-connection-direct`,
      requestOptions,
    );
  },

  async isNotifierUsing(notifierId: string) {
    const requestOptions: RequestOptions = new RequestOptions();
    return apiHelper
      .fetchGetJson<{
        isUsing: boolean;
      }>(
        `${getApplicationServer()}/api/v1/databases/notifier/${notifierId}/is-using`,
        requestOptions,
        true,
      )
      .then((res) => res.isUsing);
  },

  async isUserReadOnly(database: Database) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(database));
    return apiHelper.fetchPostJson<IsReadOnlyResponse>(
      `${getApplicationServer()}/api/v1/databases/is-readonly`,
      requestOptions,
    );
  },

  async createReadOnlyUser(database: Database) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(database));
    return apiHelper.fetchPostJson<CreateReadOnlyUserResponse>(
      `${getApplicationServer()}/api/v1/databases/create-readonly-user`,
      requestOptions,
    );
  },

  async discoverDatabases(serverConnection: ServerConnection) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(serverConnection));
    return apiHelper.fetchPostJson<DiscoverDatabasesResponse>(
      `${getApplicationServer()}/api/v1/databases/discover`,
      requestOptions,
    );
  },

  async createDatabaseBatch(
    workspaceId: string,
    databases: Database[],
    serverConnection?: ServerConnection,
    serverName?: string,
  ) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(
      JSON.stringify({
        workspaceId,
        databases,
        serverName: serverName || '',
        host: serverConnection?.host || '',
        port: serverConnection?.port || 0,
        username: serverConnection?.username || '',
        password: serverConnection?.password || '',
        isHttps: serverConnection?.isHttps || false,
      }),
    );
    return apiHelper.fetchPostJson<Database[]>(
      `${getApplicationServer()}/api/v1/databases/create-batch`,
      requestOptions,
    );
  },

  async grantReadOnlyAccess(request: GrantReadOnlyAccessRequest) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(request));
    return apiHelper.fetchPostJson<GrantReadOnlyAccessResponse>(
      `${getApplicationServer()}/api/v1/databases/grant-readonly-access`,
      requestOptions,
    );
  },
};

export interface ServerConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  isHttps: boolean;
}

export interface DiscoveredDatabase {
  name: string;
  size: number;
  owner: string;
}

export interface DiscoverDatabasesResponse {
  databases: DiscoveredDatabase[];
}

export interface GrantReadOnlyAccessRequest {
  username: string;
  host: string;
  port: number;
  adminUsername: string;
  adminPassword: string;
  isHttps: boolean;
  databases: string[];
}

export interface GrantReadOnlyAccessResponse {
  success: boolean;
  grantedDatabases: string[];
  failedDatabases: string[];
  errors?: string[];
}
