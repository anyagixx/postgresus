import { getApplicationServer } from '../../../constants';
import RequestOptions from '../../../shared/api/RequestOptions';
import { apiHelper } from '../../../shared/api/apiHelper';
import type { BackupConfig } from '../model/BackupConfig';

export const backupConfigApi = {
  async saveBackupConfig(config: BackupConfig) {
    const requestOptions: RequestOptions = new RequestOptions();
    requestOptions.setBody(JSON.stringify(config));
    return apiHelper.fetchPostJson<BackupConfig>(
      `${getApplicationServer()}/api/v1/backup-configs/save`,
      requestOptions,
    );
  },

  async getBackupConfigByDbID(databaseId: string) {
    return apiHelper.fetchGetJson<BackupConfig>(
      `${getApplicationServer()}/api/v1/backup-configs/database/${databaseId}`,
      undefined,
      true,
    );
  },

  async isStorageUsing(storageId: string): Promise<boolean> {
    return await apiHelper
      .fetchGetJson<{
        isUsing: boolean;
      }>(
        `${getApplicationServer()}/api/v1/backup-configs/storage/${storageId}/is-using`,
        undefined,
        true,
      )
      .then((res) => res.isUsing);
  },
};
