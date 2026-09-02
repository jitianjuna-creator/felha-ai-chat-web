import { detectUserLanguageIfPresent } from "./language";

const maxSpokenWords = 36;
const maxSpokenHanChars = 100;
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
      strippingEmojis(strippingSpeakerPrefix(strippingThinkingTags(text))),
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

export function isApproximateRepeat(text: string, previous: string[]): boolean {
  const compact = compactClause(text);
  if (compact.length < 2 || previous.length === 0) {
    return false;
  }
  return previous.some((item) => isSimilarRepeat(compact, compactClause(item), text, item));
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
  return text.replace(/[哈嘿呵的了呢啊呀吧嘛哦嗯\s，,。！？!?～~]/g, "");
}

function isSimilarRepeat(compact: string, other: string, raw: string, previousRaw: string): boolean {
  if (other.length < 2) {
    return false;
  }
  if (compact === other) {
    return true;
  }
  if (compact.length >= 3 && other.includes(compact)) {
    return true;
  }
  if (other.length >= 3 && compact.includes(other)) {
    return true;
  }
  const maxLen = Math.max(compact.length, other.length);
  const minLen = Math.min(compact.length, other.length);
  if (minLen >= 4 && maxLen <= minLen + 6) {
    const distance = levenshteinDistance(compact, other);
    if (distance / maxLen <= 0.4) {
      return true;
    }
  }
  const clauses = splittingClauses(raw)
    .map((item) => compactClause(item))
    .filter((item) => item.length >= 3);
  if (clauses.some((item) => other.includes(item) || (item.length >= other.length && item.includes(other)))) {
    return true;
  }
  const previousClauses = splittingClauses(previousRaw)
    .map((item) => compactClause(item))
    .filter((item) => item.length >= 3);
  return clauses.some((item) => previousClauses.some((prev) => item === prev || isShortEditRepeat(item, prev)));
}

function isShortEditRepeat(left: string, right: string): boolean {
  const maxLen = Math.max(left.length, right.length);
  const minLen = Math.min(left.length, right.length);
  if (minLen < 4 || maxLen > minLen + 6) {
    return false;
  }
  return levenshteinDistance(left, right) / maxLen <= 0.4;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }
  const rows = left.length + 1;
  const cols = right.length + 1;
  const previous = new Array<number>(cols);
  const current = new Array<number>(cols);
  for (let col = 0; col < cols; col += 1) {
    previous[col] = col;
  }
  for (let row = 1; row < rows; row += 1) {
    current[0] = row;
    const leftChar = left[row - 1];
    for (let col = 1; col < cols; col += 1) {
      const cost = leftChar === right[col - 1] ? 0 : 1;
      current[col] = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost);
    }
    for (let col = 0; col < cols; col += 1) {
      previous[col] = current[col] ?? 0;
    }
  }
  return previous[right.length] ?? 0;
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
