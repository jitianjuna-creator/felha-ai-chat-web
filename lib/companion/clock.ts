import type { ClientClock } from "./types";

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function localClockFromDate(now = new Date()): ClientClock {
  return {
    weekday: weekdays[now.getDay()] ?? "周日",
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

export function localClockInstruction(clock: ClientClock): string {
  const hour = clamp(clock.hour, 0, 23);
  const minute = clamp(clock.minute, 0, 59);
  const weekday = weekdays.includes(clock.weekday) ? clock.weekday : "周日";
  let period = "夜里";
  let greetingLock = "别说早上好。";
  if (hour >= 5 && hour < 12) {
    period = "早上";
    greetingLock = "别说晚上好、晚安，也别问晚上过得怎样。";
  } else if (hour >= 12 && hour < 17) {
    period = "下午";
    greetingLock = "别说晚上好、晚安。";
  } else if (hour >= 17 && hour < 21) {
    period = "傍晚";
    greetingLock = "别说早上好。";
  }
  const time = `${pad(hour)}:${pad(minute)}`;
  return `对方手机显示${weekday} ${time}，算${period}。问候别用错时段。${greetingLock}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}
