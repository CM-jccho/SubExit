export const PROGRESS_KEY = "ddeundeun-practice-v2";
export type Award = {
  key: string;
  day: string;
  round: string;
  kind: "first" | "revision";
  xp: number;
};
export type Progress = { awards: Award[] };
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function parseProgress(raw: string | null): Progress {
  try {
    const value = JSON.parse(raw || "{}");
    const unique = new Map<string, Award>();
    for (const a of Array.isArray(value.awards)
      ? value.awards.slice(-1000)
      : []) {
      if (
        a &&
        typeof a.round === "string" &&
        /^[a-z_]+-\d+$/.test(a.round) &&
        /^\d{4}-\d{2}-\d{2}$/.test(a.day) &&
        ["first", "revision"].includes(a.kind) &&
        a.xp === (a.kind === "first" ? 10 : 5) &&
        a.key === `${a.day}:${a.round}:${a.kind}`
      )
        unique.set(a.key, a);
    }
    return { awards: [...unique.values()] };
  } catch {
    return { awards: [] };
  }
}
export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(PROGRESS_KEY));
  } catch {
    return { awards: [] };
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {}
}
export function awardRound(
  p: Progress,
  round: string,
  revision = false,
  day = localDay(),
): Progress {
  const kind: Award["kind"] = revision ? "revision" : "first",
    key = `${day}:${round}:${kind}`;
  if (
    p.awards.some((a) => a.key === key) ||
    (revision && !p.awards.some((a) => a.key === `${day}:${round}:first`))
  )
    return p;
  return {
    awards: [
      ...p.awards,
      { key, day, round, kind, xp: revision ? 5 : 10 },
    ].slice(-1000),
  };
}
export function stats(p: Progress, now = new Date()) {
  const xp = p.awards.reduce((n, a) => n + a.xp, 0),
    days = new Set(p.awards.map((a) => a.day));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    xp,
    level: Math.floor(xp / 50) + 1,
    streak,
    days: days.size,
    rounds: p.awards.filter((a) => a.kind === "first").length,
  };
}
