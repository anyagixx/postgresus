export interface TelegramNotifier {
  botToken: string;
  targetChatId: string;
  threadId?: number;

  // temp field
  isSendToThreadEnabled?: boolean;
}
