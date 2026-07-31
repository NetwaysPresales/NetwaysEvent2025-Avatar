export type ConversationMessageStatus = 'interim' | 'final' | 'streaming' | 'complete' | 'interrupted' | 'error';

export interface ConversationSource {
  filename: string;
  chunk?: number;
  page?: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: ConversationMessageStatus;
  createdAt: string;
  locale?: string;
  languageLabel?: string;
  detectionConfidence?: string;
  sources?: ConversationSource[];
  retrievalStatus?: 'searching' | 'grounded' | 'none' | 'error';
}
