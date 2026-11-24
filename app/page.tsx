"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  defaultImageModel,
  imageAreas,
  imageFormats,
  imageModels,
  imageRatios,
  type ImageArea,
  type ImageFormat,
  type ImageModel,
  type ImageRatio,
  type MiniMaxImageResult,
  type SizeMode,
} from "@/lib/image/minimax";

const samplePrompts = [
  "27 岁东亚女生，短发，穿白色 T 恤，室内窗边自然光，像手机自拍，不要美颜过度",
  "海湾夜晚的屋顶，远处城市灯火，暖色街灯，电影感，竖构图",
  "一只橘猫趴在浅色木桌上睡觉，旁边一杯冰美式，俯拍，日系清淡",
  "产品图：磨砂黑无线耳机盒放在浅灰背景，柔和棚灯，无文字无 logo",
];

type GenerateResponse = {
  images?: MiniMaxImageResult[];
  outputFormat?: string;
  requestId?: string | null;
  usage?: unknown;
  payload?: Record<string, unknown>;
  error?: string;
};

export default function HomePage() {
  const [prompt, setPrompt] = useState(samplePrompts[0]);
  const [model, setModel] = useState<ImageModel>(defaultImageModel);
  const [sizeMode, setSizeMode] = useState<SizeMode>("area");
  const [area, setArea] = useState<ImageArea>("1K");
  const [aspectRatio, setAspectRatio] = useState<ImageRatio>("1:1");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [n, setN] = useState(1);
  const [outputFormat, setOutputFormat] = useState<ImageFormat>("jpeg");
  const [outputCompression, setOutputCompression] = useState(95);
  const [disablePromptEnhanced, setDisablePromptEnhanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const previewRatio = useMemo(() => {
    if (sizeMode === "custom" && height > 0) {
      return `${width} / ${height}`;
    }
    if (aspectRatio === "auto") {
      return "1 / 1";
    }
    return aspectRatio.replace(":", " / ");
  }, [aspectRatio, height, sizeMode, width]);

  async function onGenerate(event?: FormEvent) {
    event?.preventDefault();
    if (busy) {
      return;
    }
    const text = prompt.trim();
    if (!text) {
      setError("请填写描述");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    const started = Date.now();
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          model,
          sizeMode,
          area,
          aspectRatio,
          width,
          height,
          n,
          outputFormat,
          outputCompression,
          disablePromptEnhanced,
        }),
      });
      const json = (await response.json()) as GenerateResponse;
      setElapsedMs(Date.now() - started);
      if (!response.ok || json.error) {
        setError(json.error || "生成失败");
        return;
      }
      setResult(json);
    } catch {
      setElapsedMs(Date.now() - started);
      setError("网络失败，请再试。若已点过生成，不要连点。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row">
      <form
        className="flex w-full shrink-0 flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm lg:w-[380px]"
        onSubmit={(event) => void onGenerate(event)}
      >
        <div>
          <h1 className="text-lg font-semibold">生图测试</h1>
          <p className="mt-1 text-xs text-[#888888]">
            MiniMax-H3 · 默认 1K。生成中不要连点，超时也可能已扣费。
          </p>
        </div>

        <label className="block">
          <span className="text-sm">描述</span>
          <textarea
            className="mt-1 h-36 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] p-3 text-sm leading-6"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={8000}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((sample) => (
            <button
              key={sample}
              type="button"
              className="rounded-full border border-[#ececec] px-2.5 py-1 text-left text-xs text-[#555555]"
              onClick={() => setPrompt(sample)}
            >
              {sample.slice(0, 18)}…
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-sm">模型</span>
          <select
            className="mt-1 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm"
            value={model}
            onChange={(event) => setModel(event.target.value as ImageModel)}
          >
            {imageModels.map((item) => (
              <option key={item} value={item}>
                {item === defaultImageModel ? "标准 MiniMax-H3-Image" : "极速 MiniMax-H3-Image-Highspeed"}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-sm">尺寸方式</legend>
          <div className="mt-2 flex gap-2">
            <ModeButton
              active={sizeMode === "area"}
              onClick={() => setSizeMode("area")}
              label="档位 + 比例"
            />
            <ModeButton
              active={sizeMode === "custom"}
              onClick={() => setSizeMode("custom")}
              label="自定义宽高"
            />
          </div>
        </fieldset>

        {sizeMode === "area" ? (
          <>
            <div>
              <p className="text-sm">像素档位</p>
              <div className="mt-2 flex gap-2">
                {imageAreas.map((item) => (
                  <ModeButton
                    key={item}
                    active={area === item}
                    onClick={() => setArea(item)}
                    label={item}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-[#888888]">
                1K ≈ 1024²，2K ≈ 2048²，4K ≈ 4096²。默认 1K，4K 更贵更慢。
              </p>
            </div>
            <label className="block">
              <span className="text-sm">宽高比</span>
              <select
                className="mt-1 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm"
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value as ImageRatio)}
              >
                {imageRatios.map((item) => (
                  <option key={item} value={item}>
                    {item === "auto"
                      ? "auto（让模型自己选比例，仅默认扩写时可用）"
                      : item}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="宽 px" value={width} min={256} max={7104} onChange={setWidth} />
            <NumberField label="高 px" value={height} min={256} max={7104} onChange={setHeight} />
            <p className="col-span-2 text-xs text-[#888888]">
              面积要在 65 万到 2000 万像素，比例 1:3–3:1。选自定义时不要再传档位/比例。
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm">格式</span>
            <select
              className="mt-1 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm"
              value={outputFormat}
              onChange={(event) => setOutputFormat(event.target.value as ImageFormat)}
            >
              {imageFormats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="张数 n" value={n} min={1} max={4} onChange={setN} />
        </div>

        <label className="block">
          <span className="text-sm">
            JPEG/WebP 质量 {outputCompression}
            {outputFormat === "png" ? "（png 忽略）" : ""}
          </span>
          <input
            className="mt-2 w-full"
            type="range"
            min={0}
            max={100}
            value={outputCompression}
            disabled={outputFormat === "png"}
            onChange={(event) => setOutputCompression(Number(event.target.value))}
          />
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-[#f8f8f8] p-3">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={disablePromptEnhanced}
            onChange={(event) => {
              const checked = event.target.checked;
              setDisablePromptEnhanced(checked);
              if (checked && aspectRatio === "auto") {
                setAspectRatio("1:1");
              }
            }}
          />
          <span>
            <span className="block text-sm">严格按我写的描述出图</span>
            <span className="mt-1 block text-xs leading-5 text-[#888888]">
              默认不勾：模型会先把描述扩写成更细的英文再画，出图更稳，但可能跟原句不完全一样。出图后可看右侧「模型实际用的描述」。
              勾上后不再扩写，按原文出，适合测听不听原句。勾上时请选明确宽高比，不能用 auto。
            </span>
          </span>
        </label>

        {error ? <p className="text-sm text-[#e65a5a]">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[#4c8dff] px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "生成中…" : "生成"}
        </button>
      </form>

      <section className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-sm">
        {result?.images?.length ? (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-[#888888]">
              {elapsedMs} ms
              {result.requestId ? ` · ${result.requestId}` : ""}
            </p>
            {result.images.map((image, index) => (
              <figure key={image.url ?? index} className="flex flex-col gap-2">
                <div
                  className="overflow-hidden rounded-xl bg-[#f0f0f0]"
                  style={{ aspectRatio: previewRatio }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="h-full w-full object-contain" />
                </div>
                <figcaption className="flex flex-wrap items-center gap-3 text-xs text-[#888888]">
                  <span>{image.size || "未知尺寸"}</span>
                  <a
                    className="rounded-lg bg-[#4c8dff] px-3 py-1.5 text-white"
                    href={`/api/image/download?url=${encodeURIComponent(image.url || "")}`}
                  >
                    下载
                  </a>
                </figcaption>
                {image.revised_prompt ? (
                  <details className="text-xs text-[#666666]">
                    <summary className="cursor-pointer">模型实际用的描述（扩写后）</summary>
                    <p className="mt-2 whitespace-pre-wrap leading-5">{image.revised_prompt}</p>
                  </details>
                ) : null}
              </figure>
            ))}
            {result.payload ? (
              <details className="text-xs text-[#888888]">
                <summary className="cursor-pointer">发给 MiniMax 的参数</summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-[#f8f8f8] p-3">
                  {JSON.stringify(result.payload, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : (
          <div
            className="flex h-[min(70vh,560px)] items-center justify-center rounded-xl bg-[#f0f0f0] text-sm text-[#999999]"
            style={{ aspectRatio: previewRatio }}
          >
            {busy ? "生成中…" : "还没有图"}
          </div>
        )}
      </section>
    </main>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm ${
        active ? "bg-[#4c8dff] text-white" : "bg-[#f3f3f3] text-[#333333]"
      }`}
    >
      {label}
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-[#ececec] bg-[#f8f8f8] px-3 py-2 text-sm"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
