import { defaultModelId, isAllowedModel } from "./models";
import { defaultPersona, resolvedPersona } from "./persona";
import type { ChatMessage, StoredSession } from "./types";

const storageKey = "felha.companion.session.v2";
const listeners = new Set<() => void>();
const serverSnapshot = emptySession();

let cachedRaw: string | null = null;
let cachedSession: StoredSession = serverSnapshot;

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionSnapshot(): StoredSession {
  if (typeof window === "undefined") {
    return serverSnapshot;
  }
  const raw = window.localStorage.getItem(storageKey);
  if (raw === cachedRaw) {
    return cachedSession;
  }
  cachedRaw = raw;
  cachedSession = parseSession(raw);
  return cachedSession;
}

export function getServerSessionSnapshot(): StoredSession {
  return serverSnapshot;
}

export function writeSession(session: StoredSession): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: StoredSession = {
    ...session,
    version: 1,
    persona: resolvedPersona(session.persona),
    modelId: session.modelId || defaultModelId,
  };
  const raw = JSON.stringify(payload);
  window.localStorage.setItem(storageKey, raw);
  cachedRaw = raw;
  cachedSession = payload;
  listeners.forEach((listener) => listener());
}

export function loadSession(): StoredSession {
  return getSessionSnapshot();
}

export function saveSession(session: StoredSession): void {
  writeSession(session);
}

export function emptySession(persona = defaultPersona): StoredSession {
  return {
    version: 1,
    modelId: defaultModelId,
    persona: resolvedPersona(persona),
    messages: [],
    summary: "",
    summarizedCount: 0,
  };
}

function parseSession(raw: string | null): StoredSession {
  if (!raw) {
    return emptySession();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(isChatMessage)
      : [];
    return {
      version: 1,
      modelId:
        typeof parsed.modelId === "string" && isAllowedModel(parsed.modelId)
          ? parsed.modelId
          : defaultModelId,
      persona: resolvedPersona(parsed.persona),
      messages,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      summarizedCount:
        typeof parsed.summarizedCount === "number" && Number.isFinite(parsed.summarizedCount)
          ? Math.max(0, Math.floor(parsed.summarizedCount))
          : 0,
    };
  } catch {
    return emptySession();
  }
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as ChatMessage;
  return (
    typeof item.id === "string" &&
    (item.role === "user" ||
      item.role === "assistant" ||
      item.role === "notice" ||
      item.role === "system") &&
    typeof item.content === "string" &&
    typeof item.createdAt === "number"
  );
}
