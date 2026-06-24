"use client";

import { useState, useMemo } from "react";
import { Flag } from "lucide-react";
import type { Card } from "../data/questions";
import { renderRichText } from "../lib/richText";

interface Props {
  cards: Card[];
  subjectIndex: Map<number, number>;
  selectedSubject: string | null;
  flagged: Set<number>;
  onToggleFlag: (id: number) => void;
}

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

const SUBJECT_BG: Record<string, string> = {
  "AGENCY":                    "bg-violet-50 border-violet-100",
  "PARTNERSHIPS":              "bg-teal-50 border-teal-100",
  "CORPORATIONS & LLC'S":      "bg-indigo-50 border-indigo-100",
  "CIVIL PROCEDURE":           "bg-cyan-50 border-cyan-100",
  "CONSTITUTIONAL LAW":        "bg-red-50 border-red-100",
  "CONTRACTS":                 "bg-blue-50 border-blue-100",
  "CRIMINAL LAW & PROCEDURE":  "bg-rose-50 border-rose-100",
  "EVIDENCE":                  "bg-emerald-50 border-emerald-100",
  "REAL PROPERTY":             "bg-amber-50 border-amber-100",
  "TORTS":                     "bg-orange-50 border-orange-100",
};

function fillBlanks(context: string, blanks: Card["blanks"]): string {
  let result = context;
  for (const blank of blanks) {
    result = result.replace(
      new RegExp(`__BLANK_${blank.idx}__`, "g"),
      `++${blank.answer}++`
    );
  }
  return result;
}

interface CardProps {
  card: Card;
  number: number;
  isFlagged: boolean;
  onToggleFlag: () => void;
  defaultOpen: boolean;
}

function BrowseCard({ card, number, isFlagged, onToggleFlag, defaultOpen }: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const filledText = useMemo(() => fillBlanks(card.context, card.blanks), [card]);
  const accent = SUBJECT_ACCENT[card.subject] ?? "#6366f1";
  const bg = SUBJECT_BG[card.subject] ?? "bg-slate-50 border-slate-100";

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${bg}`}>
      {/* アクセントバー */}
      <div className="h-1" style={{ background: accent }} />

      <div className="px-4 py-3">
        {/* ヘッダー行 */}
        <div className="flex items-start gap-2">
          <span
            className="flex-shrink-0 mt-0.5 text-[11px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
            style={{ background: accent }}
          >
            {number}
          </span>
          <div className="flex-1 min-w-0">
            {card.sectionHeader && (
              <p className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: accent }}>
                {card.sectionHeader}
              </p>
            )}
            {card.subsectionTitle && (
              <p className="text-[11px] text-gray-600 truncate">{card.subsectionTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFlag(); }}
              className={`p-1 rounded-lg transition-colors ${isFlagged ? "text-amber-400" : "text-gray-300 hover:text-gray-400"}`}
            >
              <Flag size={13} fill={isFlagged ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded-lg hover:bg-white/60"
            >
              {open ? "▲" : "▼"}
            </button>
          </div>
        </div>

        {/* 展開コンテンツ */}
        {open && (
          <div className="mt-3">
            <div className="text-sm text-gray-800 leading-relaxed">
              {renderRichText(filledText)}
            </div>
            {card.translation && (
              <div className="mt-3 pt-3 border-t border-sky-200">
                <p className="text-[10px] font-semibold text-sky-500 mb-1">🇯🇵 和訳</p>
                <div className="text-xs text-gray-600 leading-relaxed">
                  {renderRichText(card.translation)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 折りたたみ時プレビュー */}
        {!open && (
          <p className="mt-1.5 text-xs text-gray-500 line-clamp-1">
            {card.context.replace(/__BLANK_\d+__/g, "…").replace(/\*\*|\+\+/g, "").slice(0, 80)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BrowseMode({ cards, subjectIndex, selectedSubject, flagged, onToggleFlag }: Props) {
  const [activeSubject, setActiveSubject] = useState<string | null>(selectedSubject);
  const [expandAll, setExpandAll] = useState(true);
  const [listKey, setListKey] = useState(0);

  const subjects = useMemo(
    () => [...new Set(cards.map((c) => c.subject))],
    [cards]
  );

  const filtered = useMemo(
    () => activeSubject ? cards.filter((c) => c.subject === activeSubject) : cards,
    [cards, activeSubject]
  );

  function toggleExpand() {
    setExpandAll((v) => !v);
    setListKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 科目タブ */}
      {subjects.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubject(null)}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
              activeSubject === null
                ? "bg-slate-700 text-white"
                : "bg-white/60 text-gray-500 border border-gray-200"
            }`}
          >
            全科目
          </button>
          {subjects.map((s) => {
            const accent = SUBJECT_ACCENT[s] ?? "#6366f1";
            const isActive = activeSubject === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setActiveSubject(s)}
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

      {/* コントロールバー */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {activeSubject ?? "すべての科目"} · {filtered.length}枚
        </p>
        <button
          type="button"
          onClick={toggleExpand}
          className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          {expandAll ? "すべて折りたたむ" : "すべて展開"}
        </button>
      </div>

      {/* カードリスト */}
      <div key={listKey} className="flex flex-col gap-2">
        {filtered.map((card) => (
          <BrowseCard
            key={card.id}
            card={card}
            number={subjectIndex.get(card.id) ?? 0}
            isFlagged={flagged.has(card.id)}
            onToggleFlag={() => onToggleFlag(card.id)}
            defaultOpen={expandAll}
          />
        ))}
      </div>
    </div>
  );
}
