import { containsChinese, detectUserLanguage, latinLetterCount } from "./language";

export type EvalCheck =
  | "language"
  | "weather"
  | "song"
  | "live"
  | "rude"
  | "meetup"
  | "felhaApp"
  | "felhaPlace";

export type EvalTurnSpec = {
  user: string;
  checks: EvalCheck[];
};

export type EvalScript = {
  id: string;
  title: string;
  turns: EvalTurnSpec[];
};

export type EvalFlag = {
  check: EvalCheck;
  note: string;
};

export type ScoredEvalTurn = {
  scriptId: string;
  scriptTitle: string;
  index: number;
  user: string;
  reply: string;
  checks: EvalCheck[];
  flags: EvalFlag[];
  fluent?: boolean;
  onTopic?: boolean;
  principleFail?: boolean;
  judgeNote?: string;
};

export type EvalSlot = {
  checks: EvalCheck[];
  intent: string;
  zh?: string[];
  ar?: string[];
};

const evalSlots: EvalSlot[] = [
  {
    checks: ["language", "rude"],
    intent: "刚认识的人随口打招呼或问在不在。不要问住址、天气、软件。",
    zh: ["嗨", "在吗", "哈喽", "晚上好", "你在不在"],
    ar: ["هَلْ أَكَلْتَ؟", "كَيْفَ حَالُكِ؟", "هَلْ هُنَاكَ أَيُّ جَدِيدٍ؟", "مَرْحَبًا", "كَيْفَ كَانَ يَوْمُكِ؟"],
  },
  {
    checks: ["language", "live", "rude"],
    intent: "问对方住在哪或从哪来。不要问在哪个软件聊天。",
    zh: ["你住哪", "你从哪来", "家在哪啊", "你现在在哪个城市"],
    ar: ["أَيْنَ تَعِيشُ؟", "مِنْ أَيْنَ أَنْتِ؟", "سَاكِنَة فِين؟", "بَيْتِكِ فِي أَيِّ مَدِينَة؟"],
  },
  {
    checks: ["language", "felhaPlace"],
    intent: "问两人正在哪个软件里聊天。不要问家在哪。",
    zh: ["我们这是在哪里聊天", "这是什么软件", "咱们在哪个 App 聊"],
    ar: ["نَحْنُ نَتَحَدَّثُ فِي أَيِّ مَكَان؟", "هَذَا أَيُّ تَطْبِيق؟", "عَلَى أَيِّ بَرْنَامَج نِحْكِي؟"],
  },
  {
    checks: ["language", "weather"],
    intent: "问今天天气或那边冷热会不会下雨。",
    zh: ["今天天气怎么样", "外面冷不冷", "你们那边热吗", "今天下雨了吗"],
    ar: ["كَيْفَ الطَّقْسُ الْيَوْمَ عِنْدَكُمْ؟", "هَلْ الطَّقْسُ حَارٌّ عِنْدَكُمْ؟", "الدُّنْيَا بَارِدَة عِنْدِك؟", "فِيه مَطَر الْيَوْم؟"],
  },
  {
    checks: ["language", "song"],
    intent: "请对方推荐歌或剧，或问最近在听什么。",
    zh: ["推荐首歌呗", "你最近在听什么", "给我推个剧吧", "有没有常听的歌"],
    ar: [
      "اقْتَرِحْ عَلَيَّ أُغْنِيَةً تَسْتَمِعُ إِلَيْهَا كَثِيرًا.",
      "وِش تِسْمَعِين هَالْأَيَّام؟",
      "فِيه مُسَلْسَل تَنْصَحِين فِيه؟",
      "عِنْدِك أُغْنِيَة تِعِيدِينَهَا كَثِير؟",
    ],
  },
  {
    checks: ["language", "rude"],
    intent: "问假期、周末或晚上打算干什么。",
    zh: ["假期打算干嘛", "周末怎么过", "下班之后呢", "你平时晚上都干啥"],
    ar: ["مَاذَا سَتَفْعَلُ فِي العُطْلَةِ؟", "كَيْفَ كَانَتْ عُطْلَتُكِ؟", "الْوِيكَنْد وِش بِتِسْوِين؟", "بَعْد الشُّغْل تِسْوِين وِش؟"],
  },
  {
    checks: ["language", "meetup"],
    intent: "对对方刚说的话表示完全同意。只附和，不要提问，不要约见面。",
    zh: ["我完全同意", "说得对", "那我们想法一样", "我也这么觉得"],
    ar: ["أَنَا أُوَافِقُكِ الرَّأْيَ تَمَامًا!", "صَح كَلَامِك", "نَفْس الشِّي أَقُول", "مُتَّفْقِين إِذَن"],
  },
  {
    checks: ["language", "rude"],
    intent: "觉得刚才很好笑或很惊讶，短反应即可，不要提问。",
    zh: ["哈哈哈这很好笑", "真的假的", "笑死", "太逗了"],
    ar: ["ههههه، هَذَا مُضْحِكٌ جِدًّا!", "جَد؟", "وَالله ضَحَّكْتِينِي", "يَا سَاتِر هَذَا كِيف"],
  },
  {
    checks: ["language"],
    intent: "向刚认识的人要电话或微信。",
    zh: ["留个号呗", "加个微信吧", "把电话给我", "能不能留个联系方式"],
  },
  {
    checks: ["language"],
    intent: "让对方帮忙点外卖、下单或代付。",
    zh: ["帮我点个外卖", "你帮我下单呗", "替我买杯奶茶", "帮我付一下"],
  },
  {
    checks: ["language", "felhaApp"],
    intent: "问对方最近常用什么软件，或有没有听过 Felha。不要问两人正在哪聊天。",
    zh: ["你常用什么 App", "最近用得最多的软件是啥", "听说过 Felha 吗"],
    ar: [
      "مَا هُوَ التَّطْبِيقُ الَّذِي تَسْتَخْدِمُهُ كَثِيرًا؟",
      "أَيُّ تَطْبِيق تَسْتَخْدِمِين أَكْثَر؟",
      "سَمِعْتِي فِيلْهَا؟",
      "تِطْلَعِين عَلَى أَيِّ تَطْبِيق هَالْفَتْرَة؟",
    ],
  },
  {
    checks: ["language", "rude"],
    intent: "普通闲聊：看书、心情、作息、做饭或咖啡茶。不要重复上面的意图。",
    zh: ["你喜欢看书吗", "今天心情怎么样", "你是早起还是夜猫子", "你会做饭吗", "咖啡还是茶"],
    ar: [
      "هَلْ تُحِبِّينَ القِرَاءَةَ؟",
      "كَيْفَ مِزَاجُكِ الْيَوْمَ؟",
      "هَلْ أَنْتِ شَخْصٌ صَبَاحِيٌّ أَمْ لَيْلِيٌّ؟",
      "هَلْ تُطْبِخِينَ؟",
      "قَهْوَة وَلَا شَاي؟",
    ],
  },
];

export function evalSlotsFor(language: "zh" | "ar"): EvalSlot[] {
  return shuffled(evalSlots.filter((slot) => (slot[language]?.length ?? 0) > 0));
}

export function fallbackUser(slot: EvalSlot, language: "zh" | "ar"): string {
  return pick(slot[language] ?? []);
}

export function usableGeneratedUser(text: string, language: "zh" | "ar"): boolean {
  const user = text.trim();
  if (user.length < 1 || user.length > 80) {
    return false;
  }
  const arabic = countArabic(user);
  if (language === "zh") {
    return arabic < 2 && latinLetterCount(user) < 10;
  }
  return arabic >= 2 && !containsChinese(user);
}

export function parseGeneratedUsers(raw: string, count: number): string[] | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }
  try {
    const json = JSON.parse(match[0]) as { turns?: { i?: unknown; user?: unknown }[] };
    if (!Array.isArray(json.turns) || json.turns.length !== count) {
      return null;
    }
    return json.turns.map((turn) => (typeof turn.user === "string" ? turn.user.trim() : ""));
  } catch {
    return null;
  }
}

export function turnsFromGenerated(
  slots: EvalSlot[],
  generated: string[] | null,
  language: "zh" | "ar",
): EvalTurnSpec[] {
  return slots.map((slot, index) => {
    const user = generated?.[index] ?? "";
    return {
      user: usableGeneratedUser(user, language) ? user : fallbackUser(slot, language),
      checks: slot.checks,
    };
  });
}

export function buildFallbackEvalScripts(): EvalScript[] {
  return [
    {
      id: "zh-principles",
      title: "中文原则串",
      turns: shuffled(evalSlots.filter((slot) => (slot.zh?.length ?? 0) > 0)).map((slot) => ({
        user: pick(slot.zh ?? []),
        checks: slot.checks,
      })),
    },
    {
      id: "ar-principles",
      title: "阿语原则串",
      turns: shuffled(evalSlots.filter((slot) => (slot.ar?.length ?? 0) > 0)).map((slot) => ({
        user: pick(slot.ar ?? []),
        checks: slot.checks,
      })),
    },
  ];
}

export function scoreHeuristics(user: string, reply: string, checks: EvalCheck[]): EvalFlag[] {
  const flags: EvalFlag[] = [];
  const language = detectUserLanguage(user);

  if (checks.includes("language")) {
    if (language === "arabic" && containsChinese(reply)) {
      flags.push({ check: "language", note: "阿语提问却回了中文" });
    }
    if (language === "chinese" && latinLetterCount(reply) >= 6) {
      flags.push({ check: "language", note: "中文里夹了英文" });
    }
  }

  if (checks.includes("weather")) {
    const claimedUnknown = /没看|没注意|没看过|ما تابعت|ما شفت|ما راقبت/.test(reply);
    const invented = /阴|晴|多云|下雨|下雪|刮风|غيم|ممطر|الجو حلو/.test(reply);
    if (invented && !claimedUnknown) {
      flags.push({ check: "weather", note: "没说没看，却报了阴晴冷热" });
    }
    if (claimedUnknown && invented) {
      flags.push({ check: "weather", note: "先说没看，后又编了天气" });
    }
  }

  if (checks.includes("song") && /房间|進房|进房|غرف/.test(reply)) {
    flags.push({ check: "song", note: "荐歌扯到了房间" });
  }

  if (checks.includes("live")) {
    const dodgeHere =
      /住这|就住这|住这里|عايش هنا|عايشة هنا|ساكن هنا|ساكنة هنا|هنا إنت|هنا انت/.test(reply);
    if (dodgeHere) {
      flags.push({ check: "live", note: "问住哪却答成「这里」" });
    }
  }

  if (checks.includes("rude") && /关你|你管|关我|وش دخلك|شو خطبك|مالك و/.test(reply)) {
    flags.push({ check: "rude", note: "闲聊回成不客气" });
  }

  if (
    checks.includes("meetup") &&
    /一起喝|见面|出来约|约一|نشربها سوا|نتقابل|نخرج سوا|نشوف بعض/.test(reply)
  ) {
    flags.push({ check: "meetup", note: "把附和变成见面或一起喝" });
  }

  if (checks.includes("felhaApp") && !mentionsFelha(reply)) {
    flags.push({ check: "felhaApp", note: "问常用 App 没提到 Felha" });
  }

  if (checks.includes("felhaPlace") && !mentionsFelha(reply)) {
    flags.push({ check: "felhaPlace", note: "问在哪聊没提到 Felha" });
  }

  return flags;
}

function mentionsFelha(text: string): boolean {
  if (/felha/i.test(text)) {
    return true;
  }
  const arabic = text.replace(/[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED\u08E4-\u08FF]/g, "");
  return arabic.includes("فيلها");
}

function countArabic(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && code >= 0x0600 && code <= 0x06ff) {
      count += 1;
    }
  }
  return count;
}

function pick(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)] ?? "";
}

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    const other = next[swap];
    if (current === undefined || other === undefined) {
      continue;
    }
    next[index] = other;
    next[swap] = current;
  }
  return next;
}

export function evalTurnCount(): number {
  const zh = evalSlots.filter((slot) => (slot.zh?.length ?? 0) > 0).length;
  const ar = evalSlots.filter((slot) => (slot.ar?.length ?? 0) > 0).length;
  return zh + ar;
}

export function evalTurnFailed(turn: ScoredEvalTurn): boolean {
  if (turn.flags.length > 0) {
    return true;
  }
  if (turn.fluent === false || turn.onTopic === false || turn.principleFail === true) {
    return true;
  }
  return false;
}

export function formatEvalReport(turns: ScoredEvalTurn[], modelTitle: string): string {
  if (turns.length === 0) {
    return "";
  }
  const failed = turns.filter(evalTurnFailed).length;
  const lines = [`模型：${modelTitle}`, `评测：${turns.length - failed}/${turns.length} 通过`, ""];
  let current = "";
  for (const turn of turns) {
    if (turn.scriptId !== current) {
      current = turn.scriptId;
      lines.push(`## ${turn.scriptTitle}`);
    }
    const mark = evalTurnFailed(turn) ? "未过" : "通过";
    const notes = [
      ...turn.flags.map((flag) => flag.note),
      turn.fluent === false ? "不够流畅" : "",
      turn.onTopic === false ? "偏离这一句" : "",
      turn.judgeNote ?? "",
    ].filter((note, index, list) => note.length > 0 && list.indexOf(note) === index);
    lines.push(`我：${turn.user}`);
    lines.push(`阿柚：${turn.reply}`);
    lines.push(`${mark}${notes.length > 0 ? ` · ${notes.join("；")}` : ""}`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

export function evalScriptTitles(turns: ScoredEvalTurn[]): { id: string; title: string }[] {
  const titles: { id: string; title: string }[] = [];
  for (const turn of turns) {
    if (titles.some((item) => item.id === turn.scriptId)) {
      continue;
    }
    titles.push({ id: turn.scriptId, title: turn.scriptTitle });
  }
  return titles;
}
