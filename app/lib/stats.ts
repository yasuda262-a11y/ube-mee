export interface CardStat {
  correct: number;  // 全blank中の正解数合計
  total: number;    // 全blank中の回答数合計
}
export type StatsRecord = Record<number, CardStat>;

const STATS_KEY = "ube_stats";

export function loadStats(): StatsRecord {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}"); } catch { return {}; }
}

export function saveStats(s: StatsRecord) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

/** カード1枚分の結果（blank単位のbool配列）を統計に記録 */
export function recordCardResult(stats: StatsRecord, cardId: number, results: boolean[]): StatsRecord {
  const cur = stats[cardId] ?? { correct: 0, total: 0 };
  const correctCount = results.filter(Boolean).length;
  const next: StatsRecord = {
    ...stats,
    [cardId]: {
      correct: cur.correct + correctCount,
      total: cur.total + results.length,
    },
  };
  saveStats(next);
  return next;
}
