"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen, LayoutList, BarChart2, ChevronDown,
  RotateCcw, CheckCircle, AlertTriangle, Minus, Shuffle,
} from "lucide-react";
import { ALL_QUESTIONS, SUBJECTS, type Question } from "./data/questions";
import FlashCard from "./components/FlashCard";
import QuestionList from "./components/QuestionList";
import { loadStats, recordResult, type StatsRecord } from "./lib/stats";

type AppMode = "select" | "study" | "list" | "stats";

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

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("select");
  const [stats, setStats] = useState<StatsRecord>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [weakOnly, setWeakOnly] = useState(false);
  const [deck, setDeck] = useState<Question[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);

  useEffect(() => { setStats(loadStats()); }, []);

  // 全体正答率
  const overallRate = useMemo(() => {
    const entries = Object.values(stats);
    const total = entries.reduce((s, e) => s + e.total, 0);
    const correct = entries.reduce((s, e) => s + e.correct, 0);
    return total > 0 ? Math.round((correct / total) * 100) : null;
  }, [stats]);

  // 現在の科目の問題
  const subjectQuestions = useMemo(() => {
    let qs = selectedSubject ? ALL_QUESTIONS.filter((q) => q.subject === selectedSubject) : ALL_QUESTIONS;
    if (weakOnly) qs = qs.filter((q) => { const s = stats[q.id]; return s && s.total > 0 && s.correct / s.total < 0.7; });
    return qs;
  }, [selectedSubject, weakOnly, stats]);

  function startDeck(questions: Question[], shuffle = true) {
    const qs = shuffle ? [...questions].sort(() => Math.random() - 0.5) : questions;
    setDeck(qs);
    setDeckIndex(0);
    setAppMode("study");
  }

  function startFrom(q: Question) {
    const idx = subjectQuestions.findIndex((x) => x.id === q.id);
    const reordered = idx >= 0
      ? [...subjectQuestions.slice(idx), ...subjectQuestions.slice(0, idx)]
      : subjectQuestions;
    setDeck(reordered);
    setDeckIndex(0);
    setAppMode("study");
  }

  function handleResult(correct: boolean) {
    const q = deck[deckIndex];
    setStats((prev) => recordResult(prev, q.id, correct));
  }

  function handleNext() {
    if (deckIndex + 1 >= deck.length) {
      setAppMode("select");
    } else {
      setDeckIndex((i) => i + 1);
    }
  }

  // ===== ホーム =====
  if (appMode === "select") {
    const weakCount = ALL_QUESTIONS.filter((q) => {
      const s = stats[q.id]; return s && s.total > 0 && s.correct / s.total < 0.7;
    }).length;
    const answeredCount = Object.values(stats).filter((s) => s.total > 0).length;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* ヘッダー */}
        <header className="px-4 py-4 flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center">
            <BookOpen size={15} className="text-slate-900" />
          </div>
          <span className="font-bold text-white tracking-wide">UBE Smart Sheets</span>
        </header>

        <main className="flex-1 flex flex-col items-center px-5 pb-10 gap-5 pt-2">
          {/* 全体進捗カード */}
          <div className="w-full max-w-sm bg-white/10 rounded-3xl p-5 text-white">
            <p className="text-xs text-white/60 mb-1">全体進捗</p>
            <div className="flex items-end gap-2 mb-2">
              {overallRate !== null
                ? <><span className="text-4xl font-bold">{overallRate}</span><span className="text-xl mb-0.5">%</span></>
                : <span className="text-2xl font-bold text-white/50">未回答</span>}
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${overallRate ?? 0}%` }} />
            </div>
            <p className="text-xs text-white/60">{answeredCount} / {ALL_QUESTIONS.length} 問回答済み</p>
          </div>

          {/* 科目選択ドロップダウン */}
          <div className="w-full max-w-sm relative">
            <button
              onClick={() => setShowSubjectMenu((v) => !v)}
              className="w-full flex items-center justify-between bg-white/10 text-white rounded-2xl px-4 py-3.5 text-sm font-semibold"
            >
              <span>{selectedSubject ?? "すべての科目"}</span>
              <ChevronDown size={16} className={`text-white/60 transition-transform ${showSubjectMenu ? "rotate-180" : ""}`} />
            </button>
            {showSubjectMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-2xl z-20 overflow-hidden shadow-xl">
                <button
                  onClick={() => { setSelectedSubject(null); setShowSubjectMenu(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${!selectedSubject ? "bg-white/10 text-white font-bold" : "text-white/70 hover:bg-white/5"}`}
                >
                  すべての科目（{ALL_QUESTIONS.length}問）
                </button>
                {SUBJECTS.map((s) => {
                  const count = ALL_QUESTIONS.filter((q) => q.subject === s).length;
                  return (
                    <button
                      key={s}
                      onClick={() => { setSelectedSubject(s); setShowSubjectMenu(false); }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${selectedSubject === s ? "bg-white/10 text-white font-bold" : "text-white/70 hover:bg-white/5"}`}
                    >
                      {s}（{count}問）
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 学習ボタン */}
          <div className="w-full max-w-sm flex flex-col gap-3">
            <button
              onClick={() => { setWeakOnly(false); startDeck(subjectQuestions); }}
              className="w-full bg-amber-400 text-slate-900 rounded-3xl px-6 py-5 flex items-center gap-4 shadow-lg hover:bg-amber-300 active:scale-95 transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-900/20 flex items-center justify-center flex-shrink-0">
                <Shuffle size={22} className="text-slate-900" />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold">学習モード</p>
                <p className="text-sm text-slate-700 mt-0.5">{subjectQuestions.length}問 シャッフル出題</p>
              </div>
            </button>

            {weakCount > 0 && (
              <button
                onClick={() => {
                  setWeakOnly(true);
                  const weak = subjectQuestions.filter((q) => {
                    const s = stats[q.id]; return s && s.total > 0 && s.correct / s.total < 0.7;
                  });
                  startDeck(weak);
                }}
                className="w-full bg-white/10 text-white rounded-3xl px-6 py-4 flex items-center gap-4 hover:bg-white/15 active:scale-95 transition-all border border-white/10"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} className="text-red-400" />
                </div>
                <div className="text-left">
                  <p className="text-base font-bold">苦手問題のみ</p>
                  <p className="text-sm text-white/50 mt-0.5">正答率70%未満 {weakCount}問</p>
                </div>
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setAppMode("list")}
                className="flex-1 bg-white/10 text-white rounded-2xl px-4 py-4 flex items-center gap-3 hover:bg-white/15 active:scale-95 transition-all border border-white/10"
              >
                <LayoutList size={18} className="text-white/70 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-bold">問題一覧</p>
                  <p className="text-xs text-white/50">検索・絞り込み</p>
                </div>
              </button>
              <button
                onClick={() => setAppMode("stats")}
                className="flex-1 bg-white/10 text-white rounded-2xl px-4 py-4 flex items-center gap-3 hover:bg-white/15 active:scale-95 transition-all border border-white/10"
              >
                <BarChart2 size={18} className="text-white/70 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-bold">統計</p>
                  <p className="text-xs text-white/50">科目別成績</p>
                </div>
              </button>
            </div>
          </div>

          {/* 科目別ミニカード */}
          <div className="w-full max-w-sm">
            <p className="text-xs text-white/40 mb-2 font-semibold">科目別</p>
            <div className="grid grid-cols-2 gap-2">
              {SUBJECTS.map((s) => {
                const qs = ALL_QUESTIONS.filter((q) => q.subject === s);
                const answered = qs.filter((q) => stats[q.id]?.total > 0).length;
                const correct = qs.filter((q) => { const st = stats[q.id]; return st && st.total > 0 && st.correct / st.total >= 0.7; }).length;
                const pct = answered > 0 ? Math.round((correct / answered) * 100) : null;
                return (
                  <button
                    key={s}
                    onClick={() => { setSelectedSubject(s); startDeck(ALL_QUESTIONS.filter((q) => q.subject === s)); }}
                    className={`${subjectColor(s)} rounded-2xl p-3 text-left text-white hover:opacity-90 active:scale-95 transition-all`}
                  >
                    <p className="text-[11px] font-bold leading-tight mb-1">{s}</p>
                    <p className="text-xs text-white/70">{qs.length}問</p>
                    {pct !== null && (
                      <p className="text-xs font-bold text-white/90 mt-0.5">{pct}%</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
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
            const qs = ALL_QUESTIONS.filter((q) => q.subject === s);
            const answered = qs.filter((q) => stats[q.id]?.total > 0);
            const correctCount = answered.filter((q) => { const st = stats[q.id]; return st.correct / st.total >= 0.7; }).length;
            const rate = answered.length > 0 ? correctCount / answered.length : null;
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
                    <div
                      className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <div className="flex gap-3 text-xs text-white/50">
                  <span>全{qs.length}問</span>
                  <span>回答済み {answered.length}問</span>
                  {pct !== null && <span className="text-emerald-400">正答 {correctCount}問</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== 問題一覧 =====
  if (appMode === "list") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-gray-800 text-sm">問題一覧</span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
          <QuestionList
            questions={subjectQuestions}
            stats={stats}
            onStartFrom={startFrom}
          />
        </div>
      </div>
    );
  }

  // ===== 学習モード =====
  const currentQ = deck[deckIndex];
  if (!currentQ) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-4xl">🎉</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800">セット完了！</h2>
        <p className="text-gray-500 text-sm">{deck.length}問を学習しました</p>
        <button
          onClick={() => startDeck(subjectQuestions)}
          className="flex items-center gap-2 bg-amber-400 text-slate-900 px-6 py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
        >
          <RotateCcw size={16} />
          もう一度
        </button>
        <button onClick={() => setAppMode("select")} className="text-sm text-indigo-600 font-semibold mt-1">
          ← ホームへ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
          <span className="font-bold text-gray-800 text-sm">
            {selectedSubject ?? "全科目"} 学習
          </span>
          <div className="w-16" />
        </div>
      </header>
      <main className="max-w-sm mx-auto px-4 pt-5 pb-10">
        <FlashCard
          question={currentQ}
          cardNumber={deckIndex + 1}
          total={deck.length}
          onResult={handleResult}
          onNext={handleNext}
        />
      </main>
    </div>
  );
}
