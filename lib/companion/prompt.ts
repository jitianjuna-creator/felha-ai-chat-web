import { localClockInstruction } from "./clock";
import {
  languageLockInstruction,
  resolvedUserLanguage,
} from "./language";
import { resolvedPersona, turnReminder } from "./persona";
import { cleanedReply } from "./reply";
import type { ChatMessage, ClientClock, ModelMessage } from "./types";

export const recentMessageLimit = 20;
export const companionTemperature = 0.75;
export const companionMaxTokens = 1024;
export const maxUserInputChars = 2000;
export const maxUnsummarizedMessages = 40;

export function visibleHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.role === "user" || message.role === "assistant");
}

export function splitHistory(messages: ChatMessage[]): {
  recent: ChatMessage[];
  older: ChatMessage[];
} {
  const history = visibleHistory(messages);
  if (history.length <= recentMessageLimit) {
    return { recent: history, older: [] };
  }
  return {
    older: history.slice(0, -recentMessageLimit),
    recent: history.slice(-recentMessageLimit),
  };
}

export function makeRequestMessages(input: {
  persona: string;
  recent: ChatMessage[];
  summary: string;
  clock: ClientClock;
}): ModelMessage[] {
  const identity = resolvedPersona(input.persona);
  const messages: ModelMessage[] = [{ role: "system", content: identity }];
  const summary = input.summary.trim();
  if (summary.length > 0) {
    messages.push({
      role: "system",
      content: `更早对话的摘要，只作背景，不要照抄：\n${summary}`,
    });
  }
  const previousAssistant: string[] = [];
  for (const message of input.recent) {
    if (message.role !== "user" && message.role !== "assistant") {
      continue;
    }
    if (message.role === "assistant") {
      const content = cleanedReply(message.content, previousAssistant);
      previousAssistant.push(content);
      messages.push({ role: "assistant", content });
      continue;
    }
    messages.push({
      role: "user",
      content: message.content,
    });
  }
  const lastUser = [...input.recent].reverse().find((message) => message.role === "user")?.content ?? "";
  const userTurns = input.recent.filter((message) => message.role === "user").length;
  const closeness =
    userTurns <= 5
      ? "还不熟。先接上一句。对上心情，不要跳话题。"
      : "已经聊了一会儿，还不算很熟。先接上一句，不要为了防备而答非所问。";
  const language = resolvedUserLanguage(lastUser, input.recent);
  messages.push({
    role: "system",
    content: `${turnReminder}\n${closeness}\n${languageLockInstruction(language)}\n${localClockInstruction(input.clock)}`,
  });
  return messages;
}

export function makeSummaryMessages(input: {
  existingSummary: string;
  unsummarized: ChatMessage[];
}): ModelMessage[] {
  const lines = input.unsummarized
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `${message.role === "user" ? "对方" : "阿柚"}: ${message.content}`);
  const existing = input.existingSummary.trim();
  return [
    {
      role: "system",
      content:
        "更新这段短信对话的滚动摘要。只保留稳定事实、称呼、拒绝过的事、没说完的线和语气。一小段中文。不要编造。不要写出下一条回复。只输出更新后的摘要。",
    },
    {
      role: "user",
      content: `已有摘要：\n${existing.length > 0 ? existing : "（无）"}\n\n新增的更早消息：\n${lines.join("\n")}`,
    },
  ];
}
