"use client";

import { useEffect, useRef, useState } from "react";
import {
  evalScriptTitles,
  evalTurnCount,
  evalTurnFailed,
  formatEvalReport,
  type ScoredEvalTurn,
} from "@/lib/companion/eval";
import { runCompanionEval } from "@/lib/companion/runEvalClient";

export function EvalPanel({
  modelId,
  modelTitle,
  persona,
  busy,
}: {
  modelId: string;
  modelTitle: string;
  persona: string;
  busy: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<ScoredEvalTurn[]>([]);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimer = useRef<number>(0);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.clearTimeout(copyTimer.current);
    };
  }, []);

  const total = evalTurnCount();
  const failed = turns.filter(evalTurnFailed).length;

  async function startEval() {
    if (running || busy) {
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError("");
    setTurns([]);
    setProgress("正在出题…");
    try {
      const results = await runCompanionEval({
        model: modelId,
        persona,
        signal: controller.signal,
        onStatus: (text) => {
          setProgress(text);
        },
        onProgress: (done, count, turn) => {
          setProgress(`${done}/${count}`);
          setTurns((current) => [...current, turn]);
        },
      });
      setTurns(results);
      setProgress("");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        setProgress("");
      } else {
        const message = caught instanceof Error ? caught.message : "评测失败";
        setError(message);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stopEval() {
    abortRef.current?.abort();
  }

  async function copyReport() {
    const text = formatEvalReport(turns, modelTitle);
    if (text.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("复制失败，请再试一次");
    }
  }

  return (
    <div className="mt-3 rounded-xl bg-[#f8f8f8] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-white px-3 py-2 text-sm disabled:opacity-40"
          onClick={() => void startEval()}
          disabled={running || busy}
        >
          跑评测
        </button>
        {running ? (
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-[#e65a5a]" onClick={stopEval}>
            停止
          </button>
        ) : null}
        {turns.length > 0 ? (
          <button type="button" className="rounded-lg px-3 py-2 text-sm text-[#4c8dff]" onClick={() => void copyReport()}>
            {copied ? "已复制" : "复制报告"}
          </button>
        ) : null}
        <p className="text-xs text-[#888888]">
          {running
            ? `评测中 ${progress}，大约一两分钟，不写入聊天记录`
            : `每次临场出题，约 ${total} 句（中文 + 阿语），仍覆盖住哪、天气、荐歌、赴约这些硬伤`}
        </p>
      </div>
      {error ? <p className="mt-2 text-xs text-[#e65a5a]">{error}</p> : null}
      {turns.length > 0 ? (
        <p className="mt-2 text-sm">
          {failed === 0 ? `${turns.length} 句都过了` : `${turns.length - failed}/${turns.length} 通过，${failed} 句有问题`}
        </p>
      ) : null}
      {evalScriptTitles(turns).map((script) => {
        const rows = turns.filter((turn) => turn.scriptId === script.id);
        if (rows.length === 0) {
          return null;
        }
        return (
          <div key={script.id} className="mt-3">
            <p className="text-xs text-[#888888]">{script.title}</p>
            <div className="mt-1 flex flex-col gap-2">
              {rows.map((turn) => (
                <EvalRow key={`${turn.scriptId}-${turn.index}`} turn={turn} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvalRow({ turn }: { turn: ScoredEvalTurn }) {
  const failed = evalTurnFailed(turn);
  const notes = [
    ...turn.flags.map((flag) => flag.note),
    turn.fluent === false ? "不够流畅" : "",
    turn.onTopic === false ? "偏离这一句" : "",
    turn.judgeNote ?? "",
  ].filter((note, index, list) => note.length > 0 && list.indexOf(note) === index);
  return (
    <div className={`rounded-lg bg-white p-2 text-sm ${failed ? "ring-1 ring-[#e65a5a]/40" : ""}`}>
      <p>
        <span className="text-[#888888]">我：</span>
        {turn.user}
      </p>
      <p className="mt-1">
        <span className="text-[#888888]">阿柚：</span>
        {turn.reply}
      </p>
      <p className={`mt-1 text-xs ${failed ? "text-[#e65a5a]" : "text-[#3d9a64]"}`}>
        {failed ? `未过${notes.length > 0 ? ` · ${notes.join("；")}` : ""}` : "通过"}
      </p>
    </div>
  );
}
