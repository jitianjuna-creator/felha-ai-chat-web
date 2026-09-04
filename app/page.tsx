"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { localClockFromDate } from "@/lib/companion/clock";
import { modelOptions } from "@/lib/companion/models";
import { defaultPersona, resolvedPersona } from "@/lib/companion/persona";
import { maxUserInputChars, recentMessageLimit, splitHistory } from "@/lib/companion/prompt";
import {
  emptySession,
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeSession,
  writeSession,
} from "@/lib/companion/storage";
import type { ChatMessage, StoredSession } from "@/lib/companion/types";
import { EvalPanel } from "./EvalPanel";

export default function HomePage() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const [draft, setDraft] = useState("");
  const [personaOpen, setPersonaOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const copyTimer = useRef<number>(0);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = listRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [session.messages, sending]);

  useEffect(() => {
    return () => {
      window.clearTimeout(copyTimer.current);
    };
  }, []);

  const selectedModel = useMemo(
    () => modelOptions.find((item) => item.modelId === session.modelId) ?? modelOptions[0],
    [session.modelId],
  );

  function updateSession(updater: (current: StoredSession) => StoredSession) {
    writeSession(updater(getSessionSnapshot()));
  }

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }
    if (text.length > maxUserInputChars) {
      setError(`消息过长，最多 ${maxUserInputChars} 字`);
      return;
    }

    const current = getSessionSnapshot();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    const nextMessages = [...current.messages, userMessage];
    const { recent, older } = splitHistory(nextMessages);
    const unsummarized = older.slice(current.summarizedCount);

    setDraft("");
    setError("");
    setSending(true);
    writeSession({
      ...current,
      messages: nextMessages,
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: current.modelId,
          persona: resolvedPersona(current.persona),
          recent,
          unsummarized,
          summary: current.summary,
          clock: localClockFromDate(),
        }),
      });
      const payload = (await response.json()) as { content?: string; summary?: string; error?: string };
      if (!response.ok || !payload.content) {
        throw new Error(payload.error || "请求失败");
      }
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: payload.content,
        createdAt: Date.now(),
      };
      const latest = getSessionSnapshot();
      writeSession({
        ...latest,
        messages: [...latest.messages, assistantMessage],
        summary: payload.summary ?? latest.summary,
        summarizedCount: older.length > 0 ? older.length : latest.summarizedCount,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "请求失败";
      setError(message);
      const latest = getSessionSnapshot();
      writeSession({
        ...latest,
        messages: [
          ...latest.messages,
          {
            id: crypto.randomUUID(),
            role: "notice",
            content: message,
            createdAt: Date.now(),
          },
        ],
      });
    } finally {
      setSending(false);
    }
  }

  function newChat() {
    setError("");
    updateSession((current) => ({
      ...emptySession(current.persona),
      modelId: current.modelId,
      persona: current.persona,
    }));
  }

  function clearChat() {
    setError("");
    updateSession((current) => ({
      ...current,
      messages: emptySession(current.persona).messages,
      summary: "",
      summarizedCount: 0,
    }));
  }

  function resetPersona() {
    updateSession((current) => ({
      ...current,
      persona: defaultPersona,
    }));
  }

  async function copyChat() {
    const text = formatChatTranscript(session.messages, selectedModel.title);
    if (text.length === 0) {
      return;
    }
    try {
      await writeClipboard(text);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请再试一次");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[760px] flex-col px-3 py-3 sm:px-4">
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">阿柚聊天测试</h1>
            <p className="mt-1 text-sm text-[#888888]">
              完整记录只存在这个浏览器。发给模型的是滚动摘要和最近 {recentMessageLimit} 条。
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-[#f0f0f0] px-3 py-2 text-sm"
            onClick={() => setPersonaOpen((open) => !open)}
          >
            {personaOpen ? "收起人设" : "编辑人设"}
          </button>
        </div>

        <label className="mt-4 block text-sm text-[#555555]">
          模型
          <select
            className="mt-1 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm"
            value={session.modelId}
            onChange={(event) =>
              updateSession((current) => ({
                ...current,
                modelId: event.target.value,
              }))
            }
          >
            {modelOptions.map((option) => (
              <option key={option.modelId} value={option.modelId}>
                {option.title} · {option.subtitle}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 text-xs text-[#999999]">{selectedModel.modelId}</p>

        {personaOpen ? (
          <div className="mt-4">
            <textarea
              className="h-56 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] p-3 text-sm leading-6"
              value={session.persona}
              onChange={(event) =>
                updateSession((current) => ({
                  ...current,
                  persona: event.target.value,
                }))
              }
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-[#4c8dff]"
                onClick={resetPersona}
              >
                恢复默认人设
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-[#e65a5a]" onClick={clearChat}>
            清空本页
          </button>
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-[#4c8dff]" onClick={newChat}>
            新对话
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-[#4c8dff] disabled:opacity-40"
            onClick={() => void copyChat()}
            disabled={session.messages.length === 0}
          >
            {copied ? "已复制" : "复制对话"}
          </button>
        </div>
        <EvalPanel
          modelId={session.modelId}
          modelTitle={selectedModel.title}
          persona={session.persona}
          busy={sending}
        />
      </header>

      <section
        ref={listRef}
        className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white p-3 shadow-sm"
      >
        {session.messages.length === 0 && !sending ? (
          <p className="py-16 text-center text-sm text-[#999999]">发一条短信开始聊</p>
        ) : (
          <div className="flex flex-col gap-3">
            {session.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
            {sending ? <p className="text-center text-xs text-[#888888]">正在输入…</p> : null}
          </div>
        )}
      </section>

      <form
        className="sticky bottom-0 mt-3 flex gap-2 rounded-2xl bg-white p-3 shadow-sm"
        onSubmit={submitMessage}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-[#ececec] px-3 py-3 text-base outline-none"
          value={draft}
          placeholder="输入消息…"
          maxLength={maxUserInputChars}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="rounded-xl bg-[#4c8dff] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={sending || draft.trim().length === 0}
        >
          发送
        </button>
      </form>
      {error ? <p className="px-1 pt-2 text-xs text-[#e65a5a]">{error}</p> : null}
    </main>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "notice") {
    return <p className="text-center text-xs text-[#888888]">{message.content}</p>;
  }
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3 py-2 text-[15px] leading-6 ${
          isUser ? "bg-[#4c8dff] text-white" : "bg-[#f5f5f5] text-[#333333]"
        }`}
      >
        <span className="opacity-70">{isUser ? "我：" : "阿柚："}</span>
        {message.content}
      </div>
    </div>
  );
}

function formatChatTranscript(messages: ChatMessage[], modelTitle: string): string {
  const lines = messages
    .map((message) => {
      if (message.role === "user") {
        return `我：${message.content}`;
      }
      if (message.role === "assistant") {
        return `阿柚：${message.content}`;
      }
      if (message.role === "notice") {
        return `系统：${message.content}`;
      }
      return "";
    })
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return "";
  }
  return [`模型：${modelTitle}`, "", ...lines].join("\n");
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(area);
  if (!copied) {
    throw new Error("copy failed");
  }
}
