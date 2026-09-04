import {
  evalSlotsFor,
  parseGeneratedUsers,
  turnsFromGenerated,
  type EvalTurnSpec,
} from "./eval";
import { SUMMARY_MODEL_ID } from "./models";
import { completeChat } from "./openrouter";

export async function generateEvalTurns(
  apiKey: string,
  language: "zh" | "ar",
): Promise<EvalTurnSpec[]> {
  const slots = evalSlotsFor(language);
  const avoid = slots
    .flatMap((slot) => (slot[language] ?? []).slice(0, 2))
    .join(" / ");
  const intents = slots.map((slot, index) => `${index}. ${slot.intent}`).join("\n");
  const languageLine =
    language === "zh"
      ? "每句只用中文。不要英文，不要阿拉伯语。"
      : "每句只用阿拉伯语。不要中文，不要拉丁字母品牌名以外的英文。";

  let parsed: string[] | null = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt += 1) {
    const raw = await completeChat({
      apiKey,
      model: SUMMARY_MODEL_ID,
      messages: [
        {
          role: "system",
          content: `你在给短信评测写「对方」说的话。不是阿柚。每句像真人刚认识时发的短信，一句以内。
${languageLine}
不要照抄这些旧题：${avoid}
只输出 JSON：{"turns":[{"i":0,"user":"..."}]}
turns 数量必须等于意图条数，i 从 0 连续编号。user 不要编号、不要引号说明。
变化标记：${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${attempt}`,
        },
        {
          role: "user",
          content: `按下面每条意图写一句对方的话：\n${intents}`,
        },
      ],
      temperature: 1,
      maxTokens: 900,
    });
    parsed = parseGeneratedUsers(raw, slots.length);
  }

  return turnsFromGenerated(slots, parsed, language);
}
