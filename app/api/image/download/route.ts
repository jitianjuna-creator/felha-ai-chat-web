export const runtime = "nodejs";

const allowedHost = /(^|\.)aliyuncs\.com$/i;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!url.startsWith("https://")) {
    return Response.json({ error: "下载地址无效" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "下载地址无效" }, { status: 400 });
  }
  if (!allowedHost.test(parsed.hostname)) {
    return Response.json({ error: "不允许的下载域名" }, { status: 400 });
  }

  const upstream = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!upstream.ok) {
    return Response.json({ error: "原图已失效，请重新生成" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const bytes = await upstream.arrayBuffer();
  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="felha-${Date.now()}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
