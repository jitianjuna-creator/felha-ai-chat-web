import {
  buildMiniMaxPayload,
  parseGenerateInput,
  type MiniMaxImageResult,
} from "@/lib/image/minimax";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(500, "服务未配置 MiniMax Key");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "请求格式无效");
  }

  const parsed = parseGenerateInput(body);
  if (typeof parsed === "string") {
    return jsonError(400, parsed);
  }

  const host = (process.env.MINIMAX_API_HOST || "https://api.minimax.cn").replace(/\/$/, "");
  const payload = buildMiniMaxPayload(parsed);

  let response: Response;
  try {
    response = await fetch(`${host}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(110_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return jsonError(
      502,
      timedOut ? "生成超时。请求可能仍在扣费，请稍后再看，不要连点。" : "无法连接 MiniMax",
    );
  }

  const raw = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    json = null;
  }

  if (!response.ok) {
    return jsonError(statusFromHttp(response.status), minimaxErrorMessage(json, raw));
  }

  const baseResp = json?.base_resp as { status_code?: unknown; status_msg?: unknown } | undefined;
  if (baseResp && baseResp.status_code !== 0 && baseResp.status_code != null) {
    const msg = typeof baseResp.status_msg === "string" ? baseResp.status_msg : "生成失败";
    return jsonError(502, msg);
  }

  const items = Array.isArray(json?.data) ? (json.data as MiniMaxImageResult[]) : [];
  const images = items.filter((item) => typeof item.url === "string" && item.url.length > 0);
  if (images.length === 0) {
    const firstError = items[0]?.error?.message || minimaxErrorMessage(json, raw);
    return jsonError(502, firstError || "没有生成出图片");
  }

  return Response.json({
    images,
    outputFormat: json?.output_format ?? parsed.outputFormat,
    requestId: json?.request_id ?? null,
    usage: json?.usage ?? null,
    payload,
  });
}

function statusFromHttp(status: number): number {
  if (status === 401 || status === 402 || status === 429) {
    return status;
  }
  if (status >= 400 && status < 500) {
    return 400;
  }
  return 502;
}

function minimaxErrorMessage(json: Record<string, unknown> | null, raw: string): string {
  if (json) {
    const error = json.error;
    if (error && typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message.trim();
      }
    }
    if (typeof json.message === "string" && json.message.trim()) {
      return json.message.trim();
    }
  }
  const fallback = raw.trim();
  return fallback.length > 180 ? `${fallback.slice(0, 180)}…` : fallback || "生成失败";
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
