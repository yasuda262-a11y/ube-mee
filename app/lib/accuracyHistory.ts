import type { StatsRecord } from "./stats";
import type { Card } from "../data/questions";

const HISTORY_KEY = "ube-accuracy-history";
const MAX_DAYS = 30;

export type AccuracySnapshot = {
  date: string; // "2026-06-15"
  overall: number;
  bySubject: Record<string, number>;
};

export function loadHistory(): AccuracySnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch { return []; }
}

function computeAccuracy(statsList: Array<{ correct: number; total: number }>): number {
  const answered = statsList.filter((s) => s.total > 0);
  if (answered.length === 0) return 0;
  const tc = answered.reduce((s, x) => s + x.correct, 0);
  const tt = answered.reduce((s, x) => s + x.total, 0);
  return tt > 0 ? Math.round((tc / tt) * 100) : 0;
}

function buildSnapshot(
  date: string,
  stats: StatsRecord,
  cards: Card[],
  subjects: string[]
): AccuracySnapshot {
  const overall = computeAccuracy(cards.map((c) => stats[c.id]).filter(Boolean));
  const bySubject: Record<string, number> = {};
  for (const s of subjects) {
    const sc = cards.filter((c) => c.subject === s);
    bySubject[s] = computeAccuracy(sc.map((c) => stats[c.id]).filter(Boolean));
  }
  return { date, overall, bySubject };
}

export function recordSnapshot(
  stats: StatsRecord,
  cards: Card[],
  subjects: string[]
): AccuracySnapshot[] {
  const today = new Date().toISOString().slice(0, 10);
  const history = loadHistory();
  const snap = buildSnapshot(today, stats, cards, subjects);

  if (history.length > 0 && history[history.length - 1].date === today) {
    history[history.length - 1] = snap;
  } else {
    history.push(snap);
  }

  const trimmed = history.slice(-MAX_DAYS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}
