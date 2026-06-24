"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen, LayoutList, BarChart2,
  RotateCcw, AlertTriangle, Shuffle, NotebookPen,
  LogIn, LogOut, User, Flag, ListOrdered, BookMarked, FileText,
} from "lucide-react";
import { ALL_CARDS, SUBJECTS, TOTAL_BLANKS, type Card } from "./data/questions";
import FlashCard from "./components/FlashCard";
import QuestionList from "./components/QuestionList";
import MemoList from "./components/MemoList";
import AuthModal from "./components/AuthModal";
import AccuracyChart from "./components/AccuracyChart";
import BrowseMode from "./components/BrowseMode";
import OutlineMode from "./components/OutlineMode";
import { ALL_MEE_CARDS } from "./data/mee-outline";
import { loadStats, recordCardResult, type StatsRecord } from "./lib/stats";
import { recordSnapshot, loadHistory, type AccuracySnapshot } from "./lib/accuracyHistory";
import { supabase } from "./lib/supabase";
import { fetchStats, saveStatRemote, fetchFlags, saveFlagsRemote } from "./lib/db";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type AppMode = "select" | "study" | "list" | "stats" | "memos" | "browse" | "outline";

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

type DeckSave = { cardIds: number[]; index: number };

function saveDeckState(subject: string | null, deck: Card[], index: number) {
  if (deck.length === 0) return;
  const key = `ube_deck_save_${subject ?? "ALL"}`;
  const save: DeckSave = { cardIds: deck.map((c) => c.id), index };
  localStorage.setItem(key, JSON.stringify(save));
}

function loadDeckState(subject: string | null): DeckSave | null {
  try {
    const key = `ube_deck_save_${subject ?? "ALL"}`;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as DeckSave) : null;
  } catch { return null; }
}

function clearDeckState(subject: string | null) {
  localStorage.removeItem(`ube_deck_save_${subject ?? "ALL"}`);
}

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("select");
  const [stats, setStats] = useState<StatsRecord>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [studyFrom, setStudyFrom] = useState<"select" | "list">("select");
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savedSubjects, setSavedSubjects] = useState<Set<string>>(new Set());
  const [accuracyHistory, setAccuracyHistory] = useState<AccuracySnapshot[]>([]);

  // 中断データがある科目を起動時に把握 & 正答率スナップショット記録
  useEffect(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("ube_deck_save_"));
    const subjects = new Set(keys.map((k) => k.replace("ube_deck_save_", "")));
    setSavedSubjects(subjects);
    setAccuracyHistory(loadHistory());
  }, []);

  // 認証状態の監視とデータ読み込み
  useEffect(() => {
    // 初期セッション取得
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
    // ログイン/ログアウトイベント
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ユーザー変化時にデータをリモートから再取得してlocalStorageに反映
  useEffect(() => {
    fetchStats().then((s) => {
      setStats(s);
      const updated = recordSnapshot(s, ALL_CARDS, SUBJECTS);
      setAccuracyHistory(updated);
    });
    fetchFlags().then(setFlagged);
    if (user) {
      // 伏字・メモもリモートから取得（localStorageキャッシュを更新）
      import("./lib/db").then(({ fetchOverrides, fetchCardMemos }) => {
        fetchOverrides().catch(() => {});
        fetchCardMemos().catch(() => {});
      });
    }
  }, [user]);

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

  const flaggedCards = useMemo(() => ALL_CARDS.filter((c) => flagged.has(c.id)), [flagged]);

  function handleToggleFlag(cardId: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      saveFlagsRemote(next).catch(() => {});
      return next;
    });
  }

  function startDeck(cards: Card[], shuffle = true) {
    const qs = shuffle ? [...cards].sort(() => Math.random() - 0.5) : cards;
    setDeck(qs);
    setDeckIndex(0);
    setStudyFrom("select");
    setAppMode("study");
    clearDeckState(selectedSubject);
    setSavedSubjects((prev) => { const n = new Set(prev); n.delete(selectedSubject ?? "ALL"); return n; });
  }

  function resumeDeck() {
    const save = loadDeckState(selectedSubject);
    if (!save) return;
    const idMap = new Map(ALL_CARDS.map((c) => [c.id, c]));
    const qs = save.cardIds.map((id) => idMap.get(id)).filter(Boolean) as Card[];
    if (qs.length === 0) return;
    setDeck(qs);
    setDeckIndex(save.index);
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
    setStats((prev) => {
      const next = recordCardResult(prev, card.id, results);
      // Supabase に非同期保存（エラーは無視してローカルは常に更新済み）
      const s = next[card.id];
      saveStatRemote(card.id, s.correct, s.total).catch(() => {});
      return next;
    });
  }

  function handleNext() {
    if (deckIndex + 1 >= deck.length) {
      clearDeckState(selectedSubject);
      setSavedSubjects((prev) => { const n = new Set(prev); n.delete(selectedSubject ?? "ALL"); return n; });
      setAppMode("select");
    } else {
      setDeckIndex((i) => i + 1);
    }
  }

  function handlePrev() {
    if (deckIndex > 0) setDeckIndex((i) => i - 1);
  }

  // ===== ホーム =====
  if (appMode === "select") {
    const answeredCount = Object.values(stats).filter((s) => s.total > 0).length;
    const progressPct = Math.round((answeredCount / ALL_CARDS.length) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        <header className="px-4 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 flex items-center justify-center">
              <BookOpen size={15} className="text-slate-900" />
            </div>
            <span className="font-bold text-white tracking-wide">UBE Smart Sheets</span>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60 flex items-center gap-1">
                <User size={12} />{user.email?.split("@")[0]}
              </span>
              <button onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
                <LogOut size={13} />ログアウト
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-amber-400 text-slate-900 px-3 py-1.5 rounded-xl hover:bg-amber-300 transition-colors">
              <LogIn size={13} />ログイン
            </button>
          )}
        </header>
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

        <main className="flex-1 flex flex-col items-center px-5 pb-10 gap-5 pt-2">
          <div className="w-full max-w-2xl flex flex-col gap-5">

          {/* 全体進捗 */}
          <div className="bg-white/10 rounded-3xl p-5 text-white">
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

          {/* 正答率推移グラフ */}
          <AccuracyChart history={accuracyHistory} />

          {/* 科目選択グリッド */}
          <div>
            <p className="text-xs text-white/40 mb-2 font-semibold">科目を選択</p>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {/* すべて */}
              <button
                onClick={() => setSelectedSubject(null)}
                className={`rounded-2xl p-3 text-left text-white transition-all active:scale-95 border-2 ${
                  !selectedSubject
                    ? "bg-white/25 border-white/60"
                    : "bg-white/10 border-transparent hover:bg-white/15"
                }`}
              >
                <p className="text-[10px] font-bold leading-tight mb-1">すべて</p>
                <p className="text-[10px] text-white/70">{ALL_CARDS.length}枚</p>
              </button>
              {SUBJECTS.map((s) => {
                const qs = ALL_CARDS.filter((c) => c.subject === s);
                const answered = qs.filter((c) => stats[c.id]?.total > 0).length;
                const pct = Math.round((answered / qs.length) * 100);
                const isSelected = selectedSubject === s;
                return (
                  <button key={s}
                    onClick={() => setSelectedSubject(isSelected ? null : s)}
                    className={`${subjectColor(s)} rounded-2xl p-3 text-left text-white transition-all active:scale-95 border-2 ${
                      isSelected ? "border-white/80 brightness-110" : "border-transparent hover:opacity-90"
                    }`}>
                    <p className="text-[10px] font-bold leading-tight mb-1">{s}</p>
                    <p className="text-[10px] text-white/70">{qs.length}枚</p>
                    <p className="text-[10px] font-bold text-white/90 mt-0.5">{pct}%</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* スタートボタン */}
          {(() => {
            const saveKey = selectedSubject ?? "ALL";
            const hasSave = savedSubjects.has(saveKey);
            const save = hasSave ? loadDeckState(selectedSubject) : null;
            const remaining = save ? save.cardIds.length - save.index : 0;
            return (
              <div className="flex flex-col gap-2">
                {hasSave && save && (
                  <button
                    onClick={resumeDeck}
                    className="w-full bg-emerald-500 text-white rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-lg hover:bg-emerald-400 active:scale-95 transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <RotateCcw size={16} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-bold leading-tight">続きから再開</p>
                      <p className="text-[11px] text-white/80">{selectedSubject ?? "すべての科目"} · 残り{remaining}枚</p>
                    </div>
                    <div
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDeckState(selectedSubject);
                        setSavedSubjects((prev) => { const n = new Set(prev); n.delete(saveKey); return n; });
                      }}
                      className="text-white/60 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
                    >
                      削除
                    </div>
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => startDeck(subjectCards)}
                    className="flex-1 bg-amber-400 text-slate-900 rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-lg hover:bg-amber-300 active:scale-95 transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-900/20 flex items-center justify-center flex-shrink-0">
                      <Shuffle size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold leading-tight">ランダム</p>
                      <p className="text-[11px] text-slate-700">{selectedSubject ?? "すべての科目"} · {subjectCards.length}枚</p>
                    </div>
                  </button>
                  <button
                    onClick={() => startDeck(subjectCards, false)}
                    className="flex-1 bg-sky-400 text-slate-900 rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-lg hover:bg-sky-300 active:scale-95 transition-all"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-900/20 flex items-center justify-center flex-shrink-0">
                      <ListOrdered size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold leading-tight">順番通り</p>
                      <p className="text-[11px] text-slate-700">{selectedSubject ?? "すべての科目"} · {subjectCards.length}枚</p>
                    </div>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* サブメニュー */}
          <div className="grid grid-cols-4 gap-1.5">
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

            <button
              onClick={() => flaggedCards.length > 0 ? startDeck(flaggedCards) : undefined}
              disabled={flaggedCards.length === 0}
              className={`rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 border transition-all active:scale-95 ${
                flaggedCards.length > 0
                  ? "bg-white/10 text-white border-white/10 hover:bg-white/15"
                  : "bg-white/5 text-white/25 border-white/5 cursor-not-allowed"
              }`}
            >
              <Flag size={14} className={flaggedCards.length > 0 ? "text-amber-400" : "text-white/20"} fill={flaggedCards.length > 0 ? "currentColor" : "none"} />
              <p className="text-[10px] font-bold leading-tight">フラグのみ</p>
              <p className="text-[9px] text-white/50">{flaggedCards.length}枚</p>
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

            <button onClick={() => setAppMode("browse")}
              className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 transition-all">
              <BookMarked size={14} className="text-sky-400" />
              <p className="text-[10px] font-bold leading-tight">閲覧</p>
              <p className="text-[9px] text-white/50">全文表示</p>
            </button>

            <button onClick={() => setAppMode("outline")}
              className="rounded-xl px-2 py-2 flex flex-col items-center gap-0.5 bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-95 transition-all">
              <FileText size={14} className="text-lime-400" />
              <p className="text-[10px] font-bold leading-tight">Outline</p>
              <p className="text-[9px] text-white/50">MEE解説</p>
            </button>
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
  // ===== Outline モード =====
  if (appMode === "outline") {
    const outlineCards = selectedSubject
      ? ALL_MEE_CARDS.filter((c) => c.subject === selectedSubject)
      : ALL_MEE_CARDS;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-gray-800 text-sm">
              {selectedSubject ?? "全科目"} · Outline
            </span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-10">
          <OutlineMode
            cards={outlineCards}
            subject={selectedSubject ?? "ALL"}
          />
        </div>
      </div>
    );
  }

  // ===== 閲覧モード =====
  if (appMode === "browse") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">← ホーム</button>
            <span className="font-bold text-gray-800 text-sm">
              {selectedSubject ?? "全科目"} · 閲覧
            </span>
            <div className="w-16" />
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 pt-4 pb-10">
          <BrowseMode
            cards={subjectCards}
            subjectIndex={SUBJECT_INDEX}
            selectedSubject={selectedSubject}
            flagged={flagged}
            onToggleFlag={handleToggleFlag}
          />
        </div>
      </div>
    );
  }

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
          <QuestionList cards={ALL_CARDS} stats={stats} subjectIndex={SUBJECT_INDEX} onStartFrom={startFrom} flagged={flagged} onToggleFlag={handleToggleFlag} />
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
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #f8f6ff 40%, #fff7f0 100%)" }}>
      <header className="sticky top-0 z-10 bg-white/70 backdrop-blur-md border-b border-white/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => {
              if (studyFrom === "select" && deck.length > 0 && deckIndex + 1 < deck.length) {
                saveDeckState(selectedSubject, deck, deckIndex);
                setSavedSubjects((prev) => new Set(prev).add(selectedSubject ?? "ALL"));
              }
              setAppMode(studyFrom);
            }}
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
          onPrev={deckIndex > 0 ? handlePrev : undefined}
          isFlagged={flagged.has(currentCard.id)}
          onToggleFlag={() => handleToggleFlag(currentCard.id)}
        />
      </main>
    </div>
  );
}
