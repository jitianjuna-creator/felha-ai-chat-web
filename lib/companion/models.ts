export type CompanionModelOption = {
  title: string;
  modelId: string;
  subtitle: string;
};

export const SUMMARY_MODEL_ID = "deepseek/deepseek-v4-flash-0731";

export const modelOptions: CompanionModelOption[] = [
  {
    title: "MiniMax M3",
    modelId: "minimax/minimax-m3",
    subtitle: "拟人首选",
  },
  {
    title: "DeepSeek V4 Flash",
    modelId: "deepseek/deepseek-v4-flash-0731",
    subtitle: "便宜稳",
  },
  {
    title: "DeepSeek V4 Pro",
    modelId: "deepseek/deepseek-v4-pro-0813",
    subtitle: "质量更高",
  },
  {
    title: "Gemini 3.7 Flash",
    modelId: "google/gemini-3.7-flash",
    subtitle: "Google 最新 Flash",
  },
  {
    title: "Qwen3.8 Flash",
    modelId: "qwen/qwen3.8-flash",
    subtitle: "多语性价比",
  },
];

export const defaultModelId = "minimax/minimax-m3";

export const allowedModelIds = new Set(modelOptions.map((item) => item.modelId));

export function isAllowedModel(modelId: string): boolean {
  return allowedModelIds.has(modelId);
}
