import type { ChatMessage, UserLanguage } from "./types";

export function detectUserLanguage(text: string): UserLanguage {
  return detectUserLanguageIfPresent(text) ?? "latin";
}

export function detectUserLanguageIfPresent(text: string): UserLanguage | null {
  const han = countCodePoints(text, 0x4e00, 0x9fff);
  const arabic = countCodePoints(text, 0x0600, 0x06ff);
  const latin = [...text].filter((char) => isLatinLetter(char)).length;
  if (han < 2 && arabic < 2 && latin < 2) {
    return null;
  }
  if (arabic >= 2 && arabic >= han) {
    return "arabic";
  }
  if (han >= 2 && han * 2 >= latin) {
    return "chinese";
  }
  return "latin";
}

export function resolvedUserLanguage(
  lastUserText: string,
  history: ChatMessage[],
): UserLanguage {
  const fromLast = detectUserLanguageIfPresent(lastUserText);
  if (fromLast) {
    return fromLast;
  }
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message.role !== "user") {
      continue;
    }
    const found = detectUserLanguageIfPresent(message.content);
    if (found) {
      return found;
    }
  }
  return "chinese";
}

export function languageLockInstruction(language: UserLanguage): string {
  switch (language) {
    case "chinese":
      return "对方刚用中文。只用中文回。不要夹任何英文单词。";
    case "arabic":
      return "对方刚用阿拉伯语。只用阿拉伯语回。不要出现中文。";
    case "latin":
      return "对方刚用英语或印地英语。只用那种语言回。不要出现中文。";
  }
}

export function languageRewriteInstruction(language: UserLanguage): string {
  switch (language) {
    case "chinese":
      return "上一稿把英文写进中文了。用同一意思改成纯中文。不要英文单词。一样短，能一句就一句。";
    case "arabic":
      return "上一稿用了中文。用同一意思改成纯阿拉伯语。一个汉字都不要。一样短，能一句就一句。";
    case "latin":
      return "上一稿用了中文。用同一意思改成纯英文。一个汉字都不要。一样短，能一句就一句。";
  }
}

export function shouldRewriteLanguage(language: UserLanguage, reply: string): boolean {
  switch (language) {
    case "chinese":
      return latinLetterCount(reply) >= 6;
    case "arabic":
    case "latin":
      return containsChinese(reply);
  }
}

export function latinLetterCount(text: string): number {
  return [...text].filter((char) => isLatinLetter(char)).length;
}

export function containsChinese(text: string): boolean {
  return countCodePoints(text, 0x4e00, 0x9fff) > 0;
}

function isLatinLetter(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
}

function countCodePoints(text: string, from: number, to: number): number {
  let count = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= from && code <= to) {
      count += 1;
    }
  }
  return count;
}
