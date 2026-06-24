"use client";

import { useState, useMemo } from "react";
import type { MeeCard } from "../data/mee-outline";
import OutlineCard from "./OutlineCard";

type PriorityFilter = "ALL" | "HIGH" | "MED" | "LOW";

const FILTER_OPTIONS: { value: PriorityFilter; label: string; style: string; inactiveStyle: string }[] = [
  { value: "ALL",  label: "すべて",  style: "bg-slate-700 text-white",    inactiveStyle: "bg-white/60 text-gray-500 border border-gray-200" },
  { value: "HIGH", label: "HIGH",   style: "bg-red-500 text-white",       inactiveStyle: "bg-red-50 text-red-400 border border-red-200" },
  { value: "MED",  label: "MED",    style: "bg-orange-400 text-white",    inactiveStyle: "bg-orange-50 text-orange-400 border border-orange-200" },
  { value: "LOW",  label: "LOW",    style: "bg-yellow-400 text-white",    inactiveStyle: "bg-yellow-50 text-yellow-500 border border-yellow-200" },
];

const SUBJECT_ACCENT: Record<string, string> = {
  "AGENCY":                    "#7c3aed",
  "PARTNERSHIPS":              "#0d9488",
  "CORPORATIONS & LLC'S":      "#4f46e5",
  "CIVIL PROCEDURE":           "#0891b2",
  "CONSTITUTIONAL LAW":        "#dc2626",
  "CONTRACTS":                 "#2563eb",
  "CRIMINAL LAW & PROCEDURE":  "#be123c",
  "EVIDENCE":                  "#059669",
  "REAL PROPERTY":             "#d97706",
  "TORTS":                     "#f97316",
};

interface Props {
  cards: MeeCard[];
  subject: string;
}

export default function OutlineMode({ cards, subject }: Props) {
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [subjectFilter, setSubjectFilter] = useState<string>(
    subject !== "ALL" ? subject : "ALL"
  );
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [cardIndex, setCardIndex] = useState(0);

  const isMultiSubject = subject === "ALL";

  // 科目一覧
  const subjects = useMemo(() => [...new Set(cards.map((c) => c.subject))], [cards]);

  // 現在科目のカード
  const subjectCards = useMemo(
    () => subjectFilter === "ALL" ? cards : cards.filter((c) => c.subject === subjectFilter),
    [cards, subjectFilter]
  );

  // セクション一覧（科目フィルタ後）
  const sections = useMemo(
    () => [...new Set(subjectCards.map((c) => c.section).filter(Boolean))],
    [subjectCards]
  );

  // フィルタ適用後のカードリスト
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjectCards.filter((c) => {
      if (priority !== "ALL" && c.priority !== priority) return false;
      if (sectionFilter !== "ALL" && c.section !== sectionFilter) return false;
      if (q) {
        const haystack = `${c.ruleTitle} ${c.body}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [subjectCards, priority, sectionFilter, search]);

  const reset = () => setCardIndex(0);

  const handleSetSubject = (s: string) => {
    setSubjectFilter(s);
    setSectionFilter("ALL");
    reset();
  };
  const handleSetPriority = (p: PriorityFilter) => { setPriority(p); reset(); };
  const handleSetSection = (s: string) => { setSectionFilter(s); reset(); };
  const handleSearch = (v: string) => { setSearch(v); reset(); };

  // 科目ごとのカード総数（通し番号表示用）
  const subjectTotals = useMemo(() => {
    const m: Record<string, number> = {};
    cards.forEach((c) => { m[c.subject] = (m[c.subject] ?? 0) + 1; });
    return m;
  }, [cards]);

  const current = filtered[cardIndex] ?? null;

  return (
    <div className="flex flex-col gap-3">
      {/* 科目フィルター（全科目モード時のみ） */}
      {isMultiSubject && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleSetSubject("ALL")}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
              subjectFilter === "ALL"
                ? "bg-slate-700 text-white"
                : "bg-white/60 text-gray-500 border border-gray-200"
            }`}
          >
            全科目
          </button>
          {subjects.map((s) => {
            const accent = SUBJECT_ACCENT[s] ?? "#6366f1";
            const isActive = subjectFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSetSubject(s)}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                  isActive ? "text-white" : "bg-white/60 text-gray-500 border border-gray-200"
                }`}
                style={isActive ? { background: accent } : undefined}
              >
                {s.length > 14 ? s.slice(0, 14) + "…" : s}
              </button>
            );
          })}
        </div>
      )}

      {/* 検索 */}
      <input
        type="search"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="🔍 ルール名・本文を検索..."
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />

      {/* 優先度フィルター */}
      <div className="flex gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSetPriority(opt.value)}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
              priority === opt.value ? opt.style : opt.inactiveStyle
            }`}
          >
            {opt.label}
            {opt.value !== "ALL" && (
              <span className="ml-0.5 opacity-70">
                ({subjectCards.filter((c) => c.priority === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* セクションフィルター */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => handleSetSection("ALL")}
            className={`px-3 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${
              sectionFilter === "ALL"
                ? "bg-indigo-600 text-white"
                : "bg-white/60 text-gray-500 border border-gray-200"
            }`}
          >
            全セクション
          </button>
          {sections.map((s) => {
            const letter = s.match(/^([A-Z])\./)?.[1] ?? s[0];
            const title = s.replace(/^[A-Z]\.\s*/, "");
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSetSection(s)}
                className={`px-3 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${
                  sectionFilter === s
                    ? "bg-indigo-600 text-white"
                    : "bg-white/60 text-gray-500 border border-gray-200"
                }`}
              >
                {letter}. {title.length > 18 ? title.slice(0, 18) + "…" : title}
              </button>
            );
          })}
        </div>
      )}

      {/* カウント */}
      <p className="text-xs text-gray-500 -mt-1">
        {filtered.length} ルール表示中 / 全{subjectCards.length}ルール
      </p>

      {/* カード */}
      {current ? (
        <OutlineCard
          card={current}
          index={cardIndex}
          total={filtered.length}
          subjectTotal={subjectTotals[current.subject] ?? 0}
          hasPrev={cardIndex > 0}
          hasNext={cardIndex < filtered.length - 1}
          onPrev={() => setCardIndex((i) => Math.max(0, i - 1))}
          onNext={() => setCardIndex((i) => Math.min(filtered.length - 1, i + 1))}
        />
      ) : (
        <div className="text-center py-12 text-gray-400 text-sm">
          条件に合うルールがありません
        </div>
      )}
    </div>
  );
}
