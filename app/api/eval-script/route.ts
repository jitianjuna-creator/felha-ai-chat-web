import { buildFallbackEvalScripts } from "@/lib/companion/eval";
import { generateEvalTurns } from "@/lib/companion/evalGenerate";
import { OpenRouterError } from "@/lib/companion/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(500, "服务未配置模型凭证");
  }

  try {
    const [zhTurns, arTurns] = await Promise.all([
      generateEvalTurns(apiKey, "zh"),
      generateEvalTurns(apiKey, "ar"),
    ]);
    return Response.json({
      scripts: [
        { id: "zh-principles", title: "中文原则串", turns: zhTurns },
        { id: "ar-principles", title: "阿语原则串", turns: arTurns },
      ],
    });
  } catch (error) {
    if (error instanceof OpenRouterError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 502;
      return jsonError(status, error.message);
    }
    return Response.json({ scripts: buildFallbackEvalScripts() });
  }
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
