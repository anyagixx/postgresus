import type { Storage } from './Storage';

export interface StorageOauthDto {
  redirectUrl: string;
  storage: Storage;
  authCode: string;
}
