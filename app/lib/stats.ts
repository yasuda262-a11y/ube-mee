export interface WordStat {
  correct: number;
  total: number;
}
export type StatsRecord = Record<number, WordStat>;

const STATS_KEY = "ube_stats";

export function loadStats(): StatsRecord {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}"); } catch { return {}; }
}

export function saveStats(s: StatsRecord) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

export function recordResult(stats: StatsRecord, id: number, correct: boolean): StatsRecord {
  const cur = stats[id] ?? { correct: 0, total: 0 };
  const next = {
    ...stats,
    [id]: { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 },
  };
  saveStats(next);
  return next;
}
