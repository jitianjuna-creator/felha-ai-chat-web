export type ChatRole = "system" | "user" | "assistant" | "notice";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ClientClock = {
  weekday: string;
  hour: number;
  minute: number;
};

export type UserLanguage = "chinese" | "arabic" | "latin";

export type StoredSession = {
  version: 1;
  modelId: string;
  persona: string;
  messages: ChatMessage[];
  summary: string;
  summarizedCount: number;
};
