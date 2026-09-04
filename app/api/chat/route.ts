import { localClockFromDate } from "@/lib/companion/clock";
import { isAllowedModel } from "@/lib/companion/models";
import { OpenRouterError } from "@/lib/companion/openrouter";
import { resolvedPersona } from "@/lib/companion/persona";
import {
  maxUnsummarizedMessages,
  maxUserInputChars,
  recentMessageLimit,
} from "@/lib/companion/prompt";
import { generateCompanionReply } from "@/lib/companion/turn";
import type { ChatMessage, ClientClock } from "@/lib/companion/types";

export const runtime = "nodejs";

type ChatRequestBody = {
  model?: unknown;
  persona?: unknown;
  recent?: unknown;
  unsummarized?: unknown;
  summary?: unknown;
  clock?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(500, "服务未配置模型凭证");
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonError(400, "请求格式无效");
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!isAllowedModel(model)) {
    return jsonError(400, "不支持的模型");
  }

  const persona = resolvedPersona(typeof body.persona === "string" ? body.persona : "");
  if (persona.length > 12000) {
    return jsonError(400, "人设过长");
  }

  const recent = parseMessages(body.recent, recentMessageLimit);
  const unsummarized = parseMessages(body.unsummarized, maxUnsummarizedMessages);
  if (!recent || !unsummarized) {
    return jsonError(400, "消息格式无效");
  }

  const lastUser = [...recent].reverse().find((message) => message.role === "user");
  if (!lastUser || lastUser.content.trim().length === 0) {
    return jsonError(400, "请输入消息");
  }
  if (lastUser.content.length > maxUserInputChars) {
    return jsonError(400, `消息过长，最多 ${maxUserInputChars} 字`);
  }

  const existingSummary = typeof body.summary === "string" ? body.summary.trim() : "";
  const clock = parseClock(body.clock);

  try {
    const { content, summary } = await generateCompanionReply({
      apiKey,
      model,
      persona,
      recent,
      unsummarized,
      summary: existingSummary,
      clock,
    });
    if (!content) {
      return jsonError(502, "空回复，请再试一次");
    }

    return Response.json({
      content,
      summary,
    });
  } catch (error) {
    if (error instanceof OpenRouterError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 502;
      return jsonError(status, error.message);
    }
    return jsonError(502, "模型请求失败，请再试一次");
  }
}

function parseMessages(value: unknown, limit: number): ChatMessage[] | null {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const messages: ChatMessage[] = [];
  for (const item of value.slice(-limit)) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const record = item as {
      id?: unknown;
      role?: unknown;
      content?: unknown;
      createdAt?: unknown;
    };
    if (record.role !== "user" && record.role !== "assistant") {
      continue;
    }
    if (typeof record.content !== "string") {
      return null;
    }
    const content = record.content.trim();
    if (content.length === 0 || content.length > maxUserInputChars * 2) {
      continue;
    }
    messages.push({
      id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
      role: record.role,
      content,
      createdAt:
        typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
          ? record.createdAt
          : Date.now(),
    });
  }
  return messages;
}

function parseClock(value: unknown): ClientClock {
  if (!value || typeof value !== "object") {
    return localClockFromDate();
  }
  const record = value as { weekday?: unknown; hour?: unknown; minute?: unknown };
  return {
    weekday: typeof record.weekday === "string" ? record.weekday : localClockFromDate().weekday,
    hour: typeof record.hour === "number" ? record.hour : localClockFromDate().hour,
    minute: typeof record.minute === "number" ? record.minute : localClockFromDate().minute,
  };
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
