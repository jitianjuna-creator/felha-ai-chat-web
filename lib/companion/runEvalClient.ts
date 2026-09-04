import { localClockFromDate } from "./clock";
import {
  buildFallbackEvalScripts,
  scoreHeuristics,
  type EvalScript,
  type ScoredEvalTurn,
} from "./eval";
import { resolvedPersona } from "./persona";
import { splitHistory } from "./prompt";
import type { ChatMessage } from "./types";

export async function runCompanionEval(input: {
  model: string;
  persona: string;
  signal?: AbortSignal;
  onStatus?: (text: string) => void;
  onProgress?: (done: number, total: number, turn: ScoredEvalTurn) => void;
}): Promise<ScoredEvalTurn[]> {
  const persona = resolvedPersona(input.persona);
  input.onStatus?.("正在出题…");
  const scripts = await loadEvalScripts(input.signal);
  const total = scripts.reduce((sum, script) => sum + script.turns.length, 0);
  const results: ScoredEvalTurn[] = [];
  let done = 0;

  for (const script of scripts) {
    const messages: ChatMessage[] = [];
    let summary = "";
    let summarizedCount = 0;

    for (const [index, spec] of script.turns.entries()) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const userMessage: ChatMessage = {
        id: `eval-${script.id}-${index}-user`,
        role: "user",
        content: spec.user,
        createdAt: Date.now(),
      };
      messages.push(userMessage);
      const { recent, older } = splitHistory(messages);
      const unsummarized = older.slice(summarizedCount);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          persona,
          recent,
          unsummarized,
          summary,
          clock: localClockFromDate(),
        }),
        signal: input.signal,
      });
      const payload = (await response.json()) as {
        content?: string;
        summary?: string;
        error?: string;
      };
      if (!response.ok || !payload.content) {
        throw new Error(payload.error || "评测请求失败");
      }

      summary = payload.summary ?? summary;
      summarizedCount = older.length > 0 ? older.length : summarizedCount;
      messages.push({
        id: `eval-${script.id}-${index}-assistant`,
        role: "assistant",
        content: payload.content,
        createdAt: Date.now(),
      });

      const turn: ScoredEvalTurn = {
        scriptId: script.id,
        scriptTitle: script.title,
        index,
        user: spec.user,
        reply: payload.content,
        checks: spec.checks,
        flags: scoreHeuristics(spec.user, payload.content, spec.checks),
      };
      results.push(turn);
      done += 1;
      input.onProgress?.(done, total, turn);
    }
  }

  return applyJudge(results, input.signal);
}

async function loadEvalScripts(signal?: AbortSignal): Promise<EvalScript[]> {
  try {
    const response = await fetch("/api/eval-script", {
      method: "POST",
      signal,
    });
    const payload = (await response.json()) as { scripts?: EvalScript[]; error?: string };
    if (!response.ok || !payload.scripts || payload.scripts.length === 0) {
      return buildFallbackEvalScripts();
    }
    return payload.scripts;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return buildFallbackEvalScripts();
  }
}

async function applyJudge(
  turns: ScoredEvalTurn[],
  signal?: AbortSignal,
): Promise<ScoredEvalTurn[]> {
  const response = await fetch("/api/eval-judge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      turns: turns.map((turn) => ({
        user: turn.user,
        reply: turn.reply,
        checks: turn.checks,
      })),
    }),
    signal,
  });
  const payload = (await response.json()) as {
    error?: string;
    turns?: { i?: number; fluent?: boolean; onTopic?: boolean; fail?: boolean; note?: string }[];
  };
  if (!response.ok || !payload.turns) {
    return turns;
  }

  return turns.map((turn, index) => {
    const judged = payload.turns?.find((item) => item.i === index) ?? payload.turns?.[index];
    if (!judged) {
      return turn;
    }
    return {
      ...turn,
      fluent: typeof judged.fluent === "boolean" ? judged.fluent : turn.fluent,
      onTopic: typeof judged.onTopic === "boolean" ? judged.onTopic : turn.onTopic,
      principleFail: judged.fail === true,
      judgeNote: judged.note ?? "",
    };
  });
}
