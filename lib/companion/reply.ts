import { detectUserLanguageIfPresent } from "./language";

const maxSpokenWords = 12;
const maxSpokenHanChars = 22;

const laughTokens = new Set([
  "haha",
  "hahaha",
  "hahahaha",
  "hahahahaha",
  "hehe",
  "hehehe",
  "lol",
  "loll",
  "lmao",
  "lmfao",
  "哈哈",
  "哈哈哈",
  "哈哈哈哈",
  "嘿嘿",
  "呵呵",
  "ههه",
  "هههه",
  "ههههه",
]);

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
    strippingRepeatedCatchphrases(
      strippingInlineLaugh(strippingLeadingLaugh(strippingEmojis(strippingSpeakerPrefix(text)))),
      previousAssistant,
    ),
  );
}

export function strippingInlineLaugh(text: string): string {
  const stripped = text
    .replace(/[哈嘿呵]{2,}/g, "")
    .replace(/(haha|hehe|lol)+/gi, "")
    .replace(/[，,]{2,}/g, "，")
    .replace(/^[，,\s]+|[，,\s]+$/g, "")
    .trim();
  return stripped.length > 0 ? stripped : text.trim();
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
  const prefixes = ["Ayu:", "Ayu：", "AI:", "AI：", "Assistant:", "Assistant："];
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

export function strippingLeadingLaugh(text: string): string {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  while (words.length > 0) {
    const token = words[0]
      .toLowerCase()
      .replace(/[.,!?~…،!？。，]+$/g, "");
    if (!laughTokens.has(token)) {
      break;
    }
    words.shift();
  }
  const kept = words.join(" ");
  return kept.length > 0 ? kept : text.trim();
}

export function shorteningReply(text: string): string {
  const collapsed = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 2)
    .join(" ");
  const sentences = splittingSpokenSentences(collapsed);
  const first = sentences[0];
  if (!first) {
    return collapsed;
  }
  const prefersChinese = detectUserLanguageIfPresent(collapsed) === "chinese";
  const keptFirst = cappingSpokenLength(first, prefersChinese);
  if (spokenLengthIsEnough(keptFirst, prefersChinese) || sentences.length < 2) {
    return keptFirst;
  }
  const combined = cappingSpokenLength(`${keptFirst} ${sentences[1]}`, prefersChinese);
  if (spokenLengthExceeds(combined, prefersChinese)) {
    return keptFirst;
  }
  return combined;
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

function spokenLengthIsEnough(text: string, prefersChinese: boolean): boolean {
  return prefersChinese ? spokenVisibleCount(text) >= 8 : spokenWordCount(text) >= 4;
}

function spokenLengthExceeds(text: string, prefersChinese: boolean): boolean {
  return prefersChinese
    ? spokenVisibleCount(text) > maxSpokenHanChars
    : spokenWordCount(text) > maxSpokenWords;
}

function cappingSpokenLength(text: string, prefersChinese: boolean): string {
  const trimmed = text.trim();
  if (!spokenLengthExceeds(trimmed, prefersChinese)) {
    return trimmed;
  }
  if (prefersChinese) {
    return [...trimmed].slice(0, maxSpokenHanChars).join("").trim() || trimmed;
  }
  return trimmed.split(/\s+/).slice(0, maxSpokenWords).join(" ");
}

function isEmojiPresentation(char: string): boolean {
  return /\p{Extended_Pictographic}/u.test(char);
}
