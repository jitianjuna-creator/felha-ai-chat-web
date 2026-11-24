export const defaultImageModel = "MiniMax-H3-Image";
export const imageModels = ["MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"] as const;
export const imageAreas = ["1K", "2K", "4K"] as const;
export const imageFormats = ["jpeg", "png", "webp"] as const;
export const imageRatios = [
  "auto",
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
  "3:1",
  "1:3",
  "21:9",
] as const;

export type ImageModel = (typeof imageModels)[number];
export type ImageArea = (typeof imageAreas)[number];
export type ImageFormat = (typeof imageFormats)[number];
export type ImageRatio = (typeof imageRatios)[number];
export type SizeMode = "area" | "custom";

export type ImageGenerateInput = {
  prompt: string;
  model: ImageModel;
  sizeMode: SizeMode;
  area: ImageArea;
  aspectRatio: ImageRatio;
  width: number;
  height: number;
  n: number;
  outputFormat: ImageFormat;
  outputCompression: number;
  disablePromptEnhanced: boolean;
};

export type MiniMaxImageResult = {
  url?: string;
  size?: string;
  revised_prompt?: string;
  error?: { code?: string; message?: string };
};

export type MiniMaxImageUsage = {
  generated_images?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number };
  output_tokens_details?: { image_tokens?: number };
};

export type ImageCostEstimate = {
  cny: number;
  textTokens: number;
  imageInTokens: number;
  imageOutTokens: number;
  generatedImages: number;
  model: ImageModel;
};

/** Official CN token prices, yuan per million. https://platform.minimax.cn/docs/pricing/overview */
const cnyPerMillion = {
  "MiniMax-H3-Image": { text: 15, imageIn: 10, imageOut: 25 },
  "MiniMax-H3-Image-Highspeed": { text: 15, imageIn: 20, imageOut: 50 },
} as const;

export function parseImageUsage(value: unknown): MiniMaxImageUsage | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as MiniMaxImageUsage;
}

export function estimateImageCostCny(
  model: ImageModel,
  usage: MiniMaxImageUsage | null,
): ImageCostEstimate | null {
  if (!usage) {
    return null;
  }
  const details = usage.input_tokens_details;
  const textTokens = Number(details?.text_tokens ?? usage.input_tokens ?? 0);
  const imageInTokens = Number(details?.image_tokens ?? 0);
  const imageOutTokens = Number(
    usage.output_tokens_details?.image_tokens ?? usage.output_tokens ?? 0,
  );
  if (![textTokens, imageInTokens, imageOutTokens].every(Number.isFinite)) {
    return null;
  }
  const price = cnyPerMillion[model];
  const cny =
    (textTokens * price.text + imageInTokens * price.imageIn + imageOutTokens * price.imageOut) /
    1_000_000;
  return {
    cny,
    textTokens,
    imageInTokens,
    imageOutTokens,
    generatedImages: Number(usage.generated_images ?? 0),
    model,
  };
}

function isOneOf<T extends string>(value: string, list: readonly T[]): value is T {
  return (list as readonly string[]).includes(value);
}

export function parseGenerateInput(body: unknown): ImageGenerateInput | string {
  if (!body || typeof body !== "object") {
    return "请求格式无效";
  }
  const record = body as Record<string, unknown>;
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  if (!prompt) {
    return "请填写描述";
  }
  if (prompt.length > 8000) {
    return "描述过长，最多 8000 字";
  }

  const disablePromptEnhanced = Boolean(record.disablePromptEnhanced);

  const model = typeof record.model === "string" ? record.model : defaultImageModel;
  if (!isOneOf(model, imageModels)) {
    return "不支持的模型";
  }

  const sizeMode = record.sizeMode === "custom" ? "custom" : "area";
  const area = typeof record.area === "string" ? record.area : "1K";
  if (!isOneOf(area, imageAreas)) {
    return "面积档位只能是 1K / 2K / 4K";
  }

  const aspectRatio = typeof record.aspectRatio === "string" ? record.aspectRatio : "1:1";
  if (!isOneOf(aspectRatio, imageRatios)) {
    return "宽高比不支持";
  }

  const width = Number(record.width);
  const height = Number(record.height);
  if (sizeMode === "custom") {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      return "自定义宽高必须是整数";
    }
    if (width < 1 || height < 1) {
      return "宽高必须大于 0";
    }
    const pixels = width * height;
    if (pixels < 655_360 || pixels > 20_000_000) {
      return "自定义像素面积要在 655360 到 20000000 之间";
    }
    const ratio = width / height;
    if (ratio < 1 / 3 || ratio > 3) {
      return "自定义宽高比要在 1:3 到 3:1 之间";
    }
  }

  if (disablePromptEnhanced && sizeMode === "area" && aspectRatio === "auto") {
    return "关闭 Prompt 增强时，请选明确宽高比，或改用自定义宽高";
  }

  const n = Number(record.n ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 4) {
    return "张数只能是 1–4";
  }

  const outputFormat = typeof record.outputFormat === "string" ? record.outputFormat : "jpeg";
  if (!isOneOf(outputFormat, imageFormats)) {
    return "格式只能是 jpeg / png / webp";
  }

  const outputCompression = Number(record.outputCompression ?? 95);
  if (
    !Number.isInteger(outputCompression) ||
    outputCompression < 0 ||
    outputCompression > 100
  ) {
    return "质量只能是 0–100";
  }

  return {
    prompt,
    model,
    sizeMode,
    area,
    aspectRatio,
    width: sizeMode === "custom" ? width : 0,
    height: sizeMode === "custom" ? height : 0,
    n,
    outputFormat,
    outputCompression,
    disablePromptEnhanced,
  };
}

export function buildMiniMaxPayload(input: ImageGenerateInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: input.n,
    output_format: input.outputFormat,
    response_format: "url",
  };
  if (input.disablePromptEnhanced) {
    payload.disable_prompt_enhanced = true;
  }
  if (input.outputFormat !== "png") {
    payload.output_compression = input.outputCompression;
  }
  if (input.sizeMode === "custom") {
    payload.size = `${input.width}x${input.height}`;
  } else {
    payload.area = input.area;
    payload.aspect_ratio = input.aspectRatio;
  }
  return payload;
}
