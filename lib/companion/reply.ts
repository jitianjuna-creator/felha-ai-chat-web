import { detectUserLanguageIfPresent } from "./language";

const maxSpokenWords = 36;
const maxSpokenHanChars = 80;
const maxSpokenSentences = 3;

const faces = [
  ":-)",
  ":-(",
  ":-/",
  ":-\\",
  ":-P",
  ":-p",
  ":-D",
  ":-O",
  ":-o",
  ":-|",
  ":-*",
  ":)",
  ":(",
  ":/",
  ":\\",
  ":P",
  ":p",
  ":D",
  ":d",
  ":O",
  ":o",
  ":3",
  ":|",
  ":*",
  ":v",
  ":V",
  ";-)",
  ";)",
  ";P",
  ";p",
  ";D",
  "=)",
  "=(",
  "=/",
  "=P",
  "=p",
  "xD",
  "XD",
  "xd",
  "xP",
  "XP",
  "^_^",
  "^^",
  "-_-",
  "T_T",
  "T.T",
  "o_o",
  "O_O",
  "<3",
  "</3",
].sort((a, b) => b.length - a.length);

const faceSet = new Set(faces.map((face) => face.toLowerCase()));

export function cleanedReply(text: string, previousAssistant: string[] = []): string {
  return shorteningReply(
    strippingRepeatedSorry(
      strippingRepeatedCatchphrases(
        strippingEmojis(strippingSpeakerPrefix(strippingThinkingTags(text))),
        previousAssistant,
      ),
      previousAssistant,
    ),
  );
}

export function strippingThinkingTags(text: string): string {
  const stripped = text
    .replace(/<[\w:-]*think[\w:-]*>[\s\S]*?<\/[\w:-]*think[\w:-]*>/gi, "")
    .replace(/<\/?[\w:-]*think[\w:-]*>/gi, "")
    .replace(/<\/?redacted_thinking>/gi, "")
    .trim();
  return stripped.length > 0 ? stripped : text.replace(/<\/?[^>]+>/g, "").trim();
}

export function strippingRepeatedCatchphrases(text: string, previousAssistant: string[]): string {
  let result = text.replace(
    /[，,\s]*(刚)?(我)?还?以为你(也是)?(外国人|老外)[^，。！？\n]{0,12}问路[^，。！？\n]*/g,
    "",
  );
  result = result.replace(/[，,\s]*(外国人|老外)[^，。！？\n]{0,8}问路[^，。！？\n]*/g, "");
  const previous = previousAssistant.join("\n");
  if (previous.length > 0) {
    const kept = splittingClauses(result).filter((clause) => {
      const compact = compactClause(clause);
      if (compact.length < 6) {
        return true;
      }
      return !previousAssistant.some((item) => compactClause(item).includes(compact));
    });
    if (kept.length > 0) {
      result = kept.join("，");
    }
  }
  result = result.replace(/[，,]{2,}/g, "，").replace(/^[，,\s]+|[，,\s]+$/g, "").trim();
  return result.length > 0 ? result : text.trim();
}

export function strippingRepeatedSorry(text: string, previousAssistant: string[]): string {
  const alreadySaidSorry = previousAssistant.some((item) => /抱歉|sorry/i.test(item));
  const stripped = alreadySaidSorry
    ? text.replace(/[，,\s]*(抱歉|sorry)[。.!！]?/gi, "")
    : text.replace(/[，,\s]+(抱歉|sorry)[。.!！]?$/i, "");
  const cleaned = stripped.replace(/[，,]{2,}/g, "，").replace(/^[，,\s]+|[，,\s]+$/g, "").trim();
  return cleaned.length > 0 ? cleaned : text.trim();
}

function splittingClauses(text: string): string[] {
  return text
    .split(/[，,、。！？!?…]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function compactClause(text: string): string {
  return text.replace(/[哈嘿呵的了呢啊呀吧嘛\s，,。！？!?]/g, "");
}

export function strippingSpeakerPrefix(text: string): string {
  let result = text.trim();
  const prefixes = ["阿柚:", "阿柚：", "Ayu:", "Ayu：", "AI:", "AI：", "Assistant:", "Assistant："];
  for (const prefix of prefixes) {
    if (result.toLowerCase().startsWith(prefix.toLowerCase())) {
      result = result.slice(prefix.length).trim();
      break;
    }
  }
  return result;
}

export function strippingEmojis(text: string): string {
  const kept = [...text]
    .filter((char) => {
      const code = char.codePointAt(0);
      if (code === 0x200d || code === 0xfe0f) {
        return false;
      }
      return !isEmojiPresentation(char);
    })
    .join("");
  const collapsed = kept
    .split(/\s+/)
    .filter((piece) => piece.length > 0)
    .join(" ");
  return strippingEmoticons(collapsed);
}

export function strippingEmoticons(text: string): string {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const kept: string[] = [];
  for (const word of words) {
    if (faceSet.has(word.toLowerCase())) {
      continue;
    }
    let trimmed = word;
    for (const face of faces) {
      if (trimmed.toLowerCase().endsWith(face.toLowerCase()) && trimmed.length > face.length) {
        trimmed = trimmed.slice(0, -face.length);
        break;
      }
    }
    if (trimmed.length === 0 || faceSet.has(trimmed.toLowerCase())) {
      continue;
    }
    kept.push(trimmed);
  }
  return kept.join(" ");
}

export function shorteningReply(text: string): string {
  const collapsed = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, maxSpokenSentences)
    .join(" ");
  const sentences = splittingSpokenSentences(collapsed);
  if (sentences.length === 0) {
    return collapsed;
  }
  const prefersChinese = detectUserLanguageIfPresent(collapsed) === "chinese";
  const kept: string[] = [];
  for (const sentence of sentences) {
    if (kept.length >= maxSpokenSentences) {
      break;
    }
    const candidate = kept.length === 0 ? sentence : joinSpoken(kept, sentence, prefersChinese);
    if (kept.length > 0 && spokenLengthExceeds(candidate, prefersChinese)) {
      break;
    }
    kept.push(sentence);
  }
  return kept.join(prefersChinese ? "" : " ").trim() || sentences[0];
}

function joinSpoken(kept: string[], sentence: string, prefersChinese: boolean): string {
  return prefersChinese ? `${kept.join("")}${sentence}` : `${kept.join(" ")} ${sentence}`;
}

function splittingSpokenSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = "";
  const chars = [...text];
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];
    current += char;
    if (!isSpokenSentenceEnd(char, next)) {
      continue;
    }
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
    current = "";
  }
  const rest = current.trim();
  if (rest.length > 0) {
    sentences.push(rest);
  }
  return sentences;
}

function isSpokenSentenceEnd(char: string, next?: string): boolean {
  if ("。！？…؟۔".includes(char) || char === "!" || char === "?") {
    return true;
  }
  if (char === ".") {
    if (next && /[A-Za-z0-9]/.test(next)) {
      return false;
    }
    return true;
  }
  return false;
}

function spokenWordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function spokenVisibleCount(text: string): number {
  return [...text].filter((char) => !/\s/.test(char)).length;
}

function spokenLengthExceeds(text: string, prefersChinese: boolean): boolean {
  return prefersChinese
    ? spokenVisibleCount(text) > maxSpokenHanChars
    : spokenWordCount(text) > maxSpokenWords;
}

function isEmojiPresentation(char: string): boolean {
  return /\p{Extended_Pictographic}/u.test(char);
}
