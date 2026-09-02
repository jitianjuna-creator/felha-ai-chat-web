import type { ModelMessage } from "./types";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  status: number;
  model: string;

  constructor(status: number, message: string, model: string) {
    super(formatOpenRouterMessage(status, message, model));
    this.name = "OpenRouterError";
    this.status = status;
    this.model = model;
  }
}

export async function completeChat(input: {
  apiKey: string;
  model: string;
  messages: ModelMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Title": "Felha Companion Web",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      messages: input.messages,
    }),
  });

  const raw = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new OpenRouterError(
      response.status,
      parseErrorMessage(json, raw),
      input.model,
    );
  }

  const content = parseReplyContent(json);
  if (!content) {
    throw new OpenRouterError(response.status, "模型空回复", input.model);
  }
  return content;
}

function parseReplyContent(json: Record<string, unknown> | null): string | null {
  if (!json) {
    return null;
  }
  const choices = json.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0] as Record<string, unknown>;
  const message = first.message as Record<string, unknown> | undefined;
  if (!message) {
    return null;
  }
  if (typeof message.content === "string") {
    const trimmed = message.content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        const item = part as { text?: unknown; type?: unknown };
        return typeof item.text === "string" ? item.text : "";
      })
      .join("")
      .trim();
    return text.length > 0 ? text : null;
  }
  return null;
}

function parseErrorMessage(json: Record<string, unknown> | null, raw: string): string {
  if (json) {
    const error = json.error;
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim().length > 0) {
        return message.trim();
      }
    }
    if (typeof json.message === "string" && json.message.trim().length > 0) {
      return json.message.trim();
    }
  }
  const fallback = raw.trim();
  return fallback.length > 180 ? `${fallback.slice(0, 180)}…` : fallback || "请求失败";
}

function formatOpenRouterMessage(status: number, message: string, model: string): string {
  const tail = model.split("/").pop() ?? model;
  if (status === 429) {
    const detail = message.trim();
    return detail.length > 0
      ? `${tail} 限流/拥堵（429）。${detail}`
      : `${tail} 限流/拥堵（429）。过一会儿再试。`;
  }
  return `HTTP ${status} · ${tail}: ${message}`;
}
