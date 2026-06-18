"use client";

import { useState, useMemo } from "react";
import type { MeeCard } from "../data/mee-outline";
import OutlineCard from "./OutlineCard";

type PriorityFilter = "ALL" | "HIGH" | "MED" | "LOW";

const FILTER_OPTIONS: { value: PriorityFilter; label: string; style: string }[] = [
  { value: "ALL",  label: "すべて",  style: "bg-slate-700 text-white" },
  { value: "HIGH", label: "HIGH",   style: "bg-red-500 text-white" },
  { value: "MED",  label: "MED",    style: "bg-orange-400 text-white" },
  { value: "LOW",  label: "LOW",    style: "bg-green-500 text-white" },
];

interface Props {
  cards: MeeCard[];
  subject: string;
}

export default function OutlineMode({ cards, subject }: Props) {
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [cardIndex, setCardIndex] = useState(0);

  // セクション一覧
  const sections = useMemo(() => {
    const s = [...new Set(cards.map((c) => c.section).filter(Boolean))];
    return s;
  }, [cards]);

  // フィルタ適用後のカードリスト
  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (priority !== "ALL" && c.priority !== priority) return false;
      if (sectionFilter !== "ALL" && c.section !== sectionFilter) return false;
      return true;
    });
  }, [cards, priority, sectionFilter]);

  // フィルタが変わったらインデックスリセット
  const handleSetPriority = (p: PriorityFilter) => {
    setPriority(p);
    setCardIndex(0);
  };
  const handleSetSection = (s: string) => {
    setSectionFilter(s);
    setCardIndex(0);
  };

  const current = filtered[cardIndex] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* 優先度フィルター */}
      <div className="flex gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSetPriority(opt.value)}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
              priority === opt.value
                ? opt.style
                : "bg-white/60 text-gray-500 border border-gray-200"
            }`}
          >
            {opt.label}
            {opt.value !== "ALL" && (
              <span className="ml-0.5 opacity-70">
                ({cards.filter((c) => c.priority === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* セクションフィルター */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
        <button
          type="button"
          onClick={() => handleSetSection("ALL")}
          className={`flex-shrink-0 px-3 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${
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
              className={`flex-shrink-0 px-3 py-1 rounded-xl text-[10px] font-semibold whitespace-nowrap transition-all ${
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

      {/* カウント */}
      <p className="text-xs text-gray-500 -mt-1">
        {filtered.length} ルール表示中 / 全{cards.length}ルール
      </p>

      {/* カード */}
      {current ? (
        <OutlineCard
          card={current}
          index={cardIndex}
          total={filtered.length}
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
