"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen, LayoutList, BarChart2, ChevronDown,
  RotateCcw, AlertTriangle, Shuffle, NotebookPen,
} from "lucide-react";
import { ALL_CARDS, SUBJECTS, TOTAL_BLANKS, type Card } from "./data/questions";
import FlashCard from "./components/FlashCard";
import QuestionList from "./components/QuestionList";
import MemoList from "./components/MemoList";
import { loadStats, recordCardResult, type StatsRecord } from "./lib/stats";

type AppMode = "select" | "study" | "list" | "stats" | "memos";

const SUBJECT_COLORS: Record<string, string> = {
  "AGENCY": "bg-violet-600",
  "CONTRACTS": "bg-blue-600",
  "TORTS": "bg-orange-500",
  "CONSTITUTIONAL LAW": "bg-red-600",
  "CRIMINAL LAW & PROCEDURE": "bg-rose-700",
  "CIVIL PROCEDURE": "bg-cyan-600",
  "EVIDENCE": "bg-emerald-600",
  "REAL PROPERTY": "bg-amber-600",
  "CORPORATIONS & LLC'S": "bg-indigo-600",
  "PARTNERSHIPS": "bg-teal-600",
};
function subjectColor(s: string) { return SUBJECT_COLORS[s] ?? "bg-gray-600"; }

// 科目ごとの通し番号 (card.id → 1-based index within subject)
const SUBJECT_INDEX: Map<number, number> = (() => {
  const m = new Map<number, number>();
  const counts: Record<string, number> = {};
  for (const c of ALL_CARDS) {
    counts[c.subject] = (counts[c.subject] ?? 0) + 1;
    m.set(c.id, counts[c.subject]);
  }
  return m;
})();

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("select");
  const [stats, setStats] = useState<StatsRecord>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);
  const [studyFrom, setStudyFrom] = useState<"select" | "list">("select");

  useEffect(() => { setStats(loadStats()); }, []);

  // 全体進捗 = 回答済みカード数 / 全カード数
  const overallRate = useMemo(() => {
    const answered = Object.values(stats).filter((s) => s.total > 0).length;
    return ALL_CARDS.length > 0 ? Math.round((answered / ALL_CARDS.length) * 100) : null;
  }, [stats]);

  const subjectCards = useMemo(() => {
    return selectedSubject ? ALL_CARDS.filter((c) => c.subject === selectedSubject) : ALL_CARDS;
  }, [selectedSubject]);

  const weakCards = useMemo(() => {
    return subjectCards.filter((c) => {
      const s = stats[c.id];
      return s && s.total > 0 && s.correct / s.total < 0.7;
    });
  }, [subjectCards, stats]);

  function startDeck(cards: Card[], shuffle = true) {
    const qs = shuffle ? [...cards].sort(() => Math.random() - 0.5) : cards;
    setDeck(qs);
    setDeckIndex(0);
    setStudyFrom("select");
    setAppMode("study");
  }

  function startFrom(card: Card) {
    const idx = ALL_CARDS.findIndex((c) => c.id === card.id);
    const reordered = idx >= 0
      ? [...ALL_CARDS.slice(idx), ...ALL_CARDS.slice(0, idx)]
      : ALL_CARDS;
    setDeck(reordered);
    setDeckIndex(0);
    setStudyFrom("list");
    setAppMode("study");
  }

  function handleResult(results: boolean[]) {
    const card = deck[deckIndex];
    setStats((prev) => recordCardResult(prev, card.id, results));
  }

  function handleNext() {
    if (deckIndex + 1 >= deck.length) setAppMode("select");
    else setDeckIndex((i) => i + 1);
  }

  // ===== ホーム =====
  if (appMode === "select") {
    const answeredCount = Object.values(stats).filter((s) => s.total > 0).length;
    const progressPct = Math.round((answeredCount / ALL_CARDS.length) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <header className="px-4 py-4 flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center">
            <BookOpen size={15} className="text-slate-900" />
          </div>
          <span className="font-bold text-white tracking-wide">UBE Smart Sheets</span>
        </header>

        <main className="flex-1 flex flex-col items-center px-5 pb-10 gap-5 pt-2">
          <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* 上段: 全体進捗 + アクションボタン 横並び */}
          <div className="flex gap-4 items-stretch">
            {/* 全体進捗 */}
            <div className="flex-1 bg-white/10 rounded-3xl p-5 text-white">
              <p className="text-xs text-white/60 mb-1">全体進捗</p>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold">{progressPct}</span><span className="text-xl mb-0.5">%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-white/60">
                {answeredCount} / {ALL_CARDS.length} カード（全{TOTAL_BLANKS}空欄）
              </p>
            </div>

            {/* アクションボタン縦並び */}
            <div className="flex flex-col gap-2 w-52 flex-shrink-0">
              {/* 科目ドロップダウン */}
              <div className="relative">
                <button
                  onClick={() => setShowSubjectMenu((v) => !v)}
                  className="w-full flex items-center justify-between bg-white/10 text-white rounded-2xl px-3 py-2.5 text-sm font-semibold"
                >
                  <span className="truncate text-xs">{selectedSubject ?? "すべての科目"}</span>
                  <ChevronDown size={14} className={`text-white/60 flex-shrink-0 ml-1 transition-transform ${showSubjectMenu ? "rotate-180" : ""}`} />
                </button>
                {showSubjectMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-2xl z-20 overflow-hidden shadow-xl">
                    <button
                      onClick={() => { setSelectedSubject(null); setShowSubjectMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-sm ${!selectedSubject ? "bg-white/10 text-white font-bold" : "text-white/70 hover:bg-white/5"}`}
                    >
                      すべての科目（{ALL_CARDS.length}カード）
                    </button>
                    {SUBJECTS.map((s) => {
                      const cnt = ALL_CARDS.filter((c) => c.subject === s).length;
                      return (
                        <button key={s}
                          onClick={() => { setSelectedSubject(s); setShowSubjectMenu(false); }}
                          className={`w-full text-left px-4 py-3 text-sm ${selectedSubject === s ? "bg-white/10 text-white font-bold" : "text-white/70 hover:bg-white/5"}`}
                        >
                          {s}（{cnt}カード）
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 学習モード */}
              <button
                onClick={() => startDeck(subjectCards)}
                className="w-full bg-amber-400 text-slate-900 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-lg hover:bg-amber-300 active:scale-95 transition-all"
              >
                <div className="w-7 h-7 rounded-xl bg-slate-900/20 flex items-center justify-center flex-shrink-0">
                  <Shuffle size={14} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold leading-tight">学習モード</p>
                  <p className="text-[10px] text-slate-700">{subjectCards.length}カード</p>
                </div>
              </button>

              {/* 4ボタン 2×2 グリッド */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => weakCards.length > 0 ? startDeck(weakCards) : undefined}
                  disabled={weakCards.length === 0}
                  className={`rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 border transition-all active:scale-95 ${
                    weakCards.length > 0
                      ? "bg-white/10 text-white border-white/10 hover:bg-white/15"
                      : "bg-white/5 text-white/25 border-white/5 cursor-not-allowed"
                  }`}
                >
                  <AlertTriangle size={14} className={weakCards.length > 0 ? "text-red-400" : "text-white/20"} />
                  <p className="text-[10px] font-bold leading-tight">苦手のみ</p>
                  <p className="text-[9px] text-white/50">{weakCards.length}枚</p>
                </button>

                <button onClick={() => setAppMode("list")}
                  className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 transition-all">
                  <LayoutList size={14} className="text-white/70" />
                  <p className="text-[10px] font-bold leading-tight">カード一覧</p>
                  <p className="text-[9px] text-white/50">検索・絞込</p>
                </button>

                <button onClick={() => setAppMode("stats")}
                  className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 transition-all">
                  <BarChart2 size={14} className="text-white/70" />
                  <p className="text-[10px] font-bold leading-tight">統計</p>
                  <p className="text-[9px] text-white/50">科目別成績</p>
                </button>

                <button onClick={() => setAppMode("memos")}
                  className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 transition-all">
                  <NotebookPen size={14} className="text-emerald-400" />
                  <p className="text-[10px] font-bold leading-tight">表現メモ</p>
                  <p className="text-[9px] text-white/50">英語表現集</p>
                </button>
              </div>
            </div>
          </div>

          {/* 科目別グリッド（4列） */}
          <div>
            <p className="text-xs text-white/40 mb-2 font-semibold">科目別</p>
            <div className="grid grid-cols-4 gap-2">
              {SUBJECTS.map((s) => {
                const qs = ALL_CARDS.filter((c) => c.subject === s);
                const answered = qs.filter((c) => stats[c.id]?.total > 0).length;
                const pct = Math.round((answered / qs.length) * 100);
                return (
                  <button key={s}
                    onClick={() => { setSelectedSubject(s); startDeck(ALL_CARDS.filter((c) => c.subject === s)); }}
                    className={`${subjectColor(s)} rounded-2xl p-3 text-left text-white hover:opacity-90 active:scale-95 transition-all`}>
                    <p className="text-[10px] font-bold leading-tight mb-1">{s}</p>
                    <p className="text-[10px] text-white/70">{qs.length}カード</p>
                    <p className="text-[10px] font-bold text-white/90 mt-0.5">{pct}%</p>
                  </button>
                );
              })}
            </div>
          </div>

          </div>{/* max-w-2xl */}
        </main>
      </div>
    );
  }

  // ===== 統計 =====
  if (appMode === "stats") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
        <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur border-b border-white/10 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-amber-400 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-white text-sm">科目別統計</span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10 flex flex-col gap-3">
          {SUBJECTS.map((s) => {
            const qs = ALL_CARDS.filter((c) => c.subject === s);
            const answered = qs.filter((c) => stats[c.id]?.total > 0);
            const correct = answered.filter((c) => { const st = stats[c.id]; return st.correct / st.total >= 0.7; }).length;
            const rate = answered.length > 0 ? correct / answered.length : null;
            const pct = rate !== null ? Math.round(rate * 100) : null;
            return (
              <div key={s} className="bg-white/10 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{s}</span>
                  {pct !== null
                    ? <span className={`text-lg font-bold ${pct >= 70 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                    : <span className="text-white/40 text-sm">未回答</span>}
                </div>
                {pct !== null && (
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="flex gap-3 text-xs text-white/50">
                  <span>全{qs.length}カード</span>
                  <span>回答済み {answered.length}</span>
                  {pct !== null && <span className="text-emerald-400">正答 {correct}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== 表現メモ =====
  if (appMode === "memos") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              <NotebookPen size={14} className="text-emerald-500" /> 英語表現メモ
            </span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
          <MemoList onBack={() => setAppMode("select")} />
        </div>
      </div>
    );
  }

  // ===== カード一覧 =====
  if (appMode === "list") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-gray-800 text-sm">カード一覧</span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-10">
          <QuestionList cards={ALL_CARDS} stats={stats} subjectIndex={SUBJECT_INDEX} onStartFrom={startFrom} />
        </div>
      </div>
    );
  }

  // ===== 学習モード =====
  const currentCard = deck[deckIndex];
  if (!currentCard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-4xl">🎉</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800">セット完了！</h2>
        <p className="text-gray-500 text-sm">{deck.length}カードを学習しました</p>
        <button onClick={() => startDeck(subjectCards)}
          className="flex items-center gap-2 bg-amber-400 text-slate-900 px-6 py-3 rounded-2xl font-bold shadow-md active:scale-95">
          <RotateCcw size={16} />もう一度
        </button>
        <button onClick={() => setAppMode("select")} className="text-sm text-indigo-600 font-semibold mt-1">← ホームへ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setAppMode(studyFrom)}
            className="text-indigo-600 font-semibold text-sm"
          >
            {studyFrom === "list" ? "← 一覧" : "← ホーム"}
          </button>
          <span className="font-bold text-gray-800 text-sm">{selectedSubject ?? "全科目"} 学習</span>
          <div className="w-16" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-10">
        <FlashCard
          card={currentCard}
          cardNumber={deckIndex + 1}
          total={deck.length}
          subjectIndex={SUBJECT_INDEX.get(currentCard.id) ?? 0}
          onResult={handleResult}
          onNext={handleNext}
        />
      </main>
    </div>
  );
}
