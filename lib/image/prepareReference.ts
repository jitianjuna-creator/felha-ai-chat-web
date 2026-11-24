const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const maxDataUrlChars = 2_800_000;
const maxLongEdge = 2048;

export async function prepareReferenceImage(file: File): Promise<string> {
  const type = file.type.toLowerCase();
  if (!allowedTypes.has(type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("参考图只支持 jpeg / png / webp");
  }
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, maxLongEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  if (width < 128 || height < 128) {
    throw new Error("参考图宽高至少 128 像素");
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  if (ratio > 4) {
    throw new Error("参考图长宽比不能超过 4:1");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法处理这张图");
  }
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.88;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > maxDataUrlChars && quality > 0.5) {
    quality -= 0.08;
    output = canvas.toDataURL("image/jpeg", quality);
  }
  if (output.length > maxDataUrlChars) {
    throw new Error("图片太大，请换一张更小的");
  }
  return output;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片损坏或格式不支持"));
    image.src = src;
  });
}
