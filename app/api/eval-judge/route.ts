import { completeChat, OpenRouterError } from "@/lib/companion/openrouter";
import { SUMMARY_MODEL_ID } from "@/lib/companion/models";
import type { EvalCheck } from "@/lib/companion/eval";

export const runtime = "nodejs";
export const maxDuration = 60;

type JudgeTurn = {
  user?: unknown;
  reply?: unknown;
  checks?: unknown;
};

type JudgeBody = {
  turns?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return jsonError(500, "服务未配置模型凭证");
  }

  let body: JudgeBody;
  try {
    body = (await request.json()) as JudgeBody;
  } catch {
    return jsonError(400, "请求格式无效");
  }

  if (!Array.isArray(body.turns) || body.turns.length === 0) {
    return jsonError(400, "没有可评判的回合");
  }
  if (body.turns.length > 40) {
    return jsonError(400, "回合过多");
  }

  const turns: { user: string; reply: string; checks: EvalCheck[] }[] = [];
  for (const item of body.turns as JudgeTurn[]) {
    if (!item || typeof item.user !== "string" || typeof item.reply !== "string") {
      return jsonError(400, "回合格式无效");
    }
    const checks = Array.isArray(item.checks)
      ? item.checks.filter((check): check is EvalCheck => typeof check === "string")
      : [];
    turns.push({
      user: item.user.slice(0, 500),
      reply: item.reply.slice(0, 500),
      checks,
    });
  }

  const numbered = turns
    .map((turn, index) => {
      const checks = turn.checks.length > 0 ? turn.checks.join(",") : "无";
      return `${index}. 对方：${turn.user}\n阿柚：${turn.reply}\n检查：${checks}`;
    })
    .join("\n\n");

  try {
    const raw = await completeChat({
      apiKey,
      model: SUMMARY_MODEL_ID,
      messages: [
        {
          role: "system",
          content: `你在评阿柚的短信对答。只输出 JSON，不要markdown。格式：{"turns":[{"i":0,"fluent":true,"onTopic":true,"fail":false,"note":""}]}
规则：
- fluent：像真人短信，不生硬、不答非所问的客套。
- onTopic：回的是对方刚那句，没突然换到猫、房间、告辞。
- fail：违反原则。原则包括：闲聊不客气；编天气（没看却报阴晴）；荐歌扯房间；住哪答「这里」；附和变成见面/一起喝；问在哪聊或常用App却不提 Felha。
- note：一句话中文，说明问题；通过则空字符串。
turns 数量必须和输入一致，i 从 0 连续编号。`,
        },
        {
          role: "user",
          content: numbered,
        },
      ],
      temperature: 0.1,
      maxTokens: 1200,
    });
    const parsed = parseJudge(raw, turns.length);
    if (!parsed) {
      return jsonError(502, "评判解析失败");
    }
    return Response.json({ turns: parsed });
  } catch (error) {
    if (error instanceof OpenRouterError) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 502;
      return jsonError(status, error.message);
    }
    return jsonError(502, "评判请求失败");
  }
}

function parseJudge(
  raw: string,
  count: number,
): { i: number; fluent: boolean; onTopic: boolean; fail: boolean; note: string }[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    const json = JSON.parse(match[0]) as {
      turns?: { i?: unknown; fluent?: unknown; onTopic?: unknown; fail?: unknown; note?: unknown }[];
    };
    if (!Array.isArray(json.turns) || json.turns.length !== count) {
      return null;
    }
    return json.turns.map((turn, index) => ({
      i: typeof turn.i === "number" ? turn.i : index,
      fluent: turn.fluent === true,
      onTopic: turn.onTopic === true,
      fail: turn.fail === true,
      note: typeof turn.note === "string" ? turn.note.trim() : "",
    }));
  } catch {
    return null;
  }
}

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}
