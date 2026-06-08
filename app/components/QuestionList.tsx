"use client";

import { useState, useMemo } from "react";
import { Search, CheckCircle, XCircle, Minus } from "lucide-react";
import type { Card } from "../data/questions";
import type { StatsRecord } from "../lib/stats";

const PRIORITY_COLOR: Record<string, string> = {
  H: "text-red-500 bg-red-50 border-red-200",
  M: "text-orange-500 bg-orange-50 border-orange-200",
  L: "text-yellow-600 bg-yellow-50 border-yellow-200",
};

interface Props {
  cards: Card[];
  stats: StatsRecord;
  onStartFrom: (card: Card) => void;
}

export default function QuestionList({ cards, stats, onStartFrom }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "weak" | "unanswered">("all");

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const s = stats[c.id];
      if (filter === "weak") {
        if (!s || s.total === 0) return false;
        return s.correct / s.total < 0.7;
      }
      if (filter === "unanswered") return !s || s.total === 0;
      if (query) {
        const lq = query.toLowerCase();
        return c.context.toLowerCase().includes(lq) ||
          c.blanks.some((b) => b.answer.toLowerCase().includes(lq)) ||
          (c.sectionHeader ?? "").toLowerCase().includes(lq) ||
          (c.subsectionTitle ?? "").toLowerCase().includes(lq);
      }
      return true;
    });
  }, [cards, stats, filter, query]);

  function rateInfo(id: number) {
    const s = stats[id];
    if (!s || s.total === 0) return null;
    return { rate: s.correct / s.total, pct: Math.round((s.correct / s.total) * 100), correct: s.correct, total: s.total };
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([["all", "すべて"], ["weak", "苦手"], ["unanswered", "未回答"]] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setFilter(v); setQuery(""); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
              filter === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">{filtered.length} 件</p>

      <div className="flex flex-col gap-1.5">
        {filtered.map((c) => {
          const info = rateInfo(c.id);
          const preview = c.context.replace(/__BLANK_\d+__/g, "[ ? ]").slice(0, 80) + "…";
          const answers = c.blanks.map((b) => b.answer).join(" / ");
          return (
            <button
              key={c.id}
              onClick={() => onStartFrom(c)}
              className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-left flex items-start gap-3 hover:border-indigo-200 hover:bg-indigo-50 transition-colors active:scale-95"
            >
              <div className="mt-0.5 flex-shrink-0">
                {!info
                  ? <Minus size={15} className="text-gray-300" />
                  : info.rate >= 0.7
                  ? <CheckCircle size={15} className="text-emerald-400" />
                  : <XCircle size={15} className="text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-500 font-semibold mb-0.5 truncate">{answers}</p>
                <p className="text-xs text-gray-500 leading-5 line-clamp-2">{preview}</p>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{c.subject}</span>
                  {c.sectionHeader && (
                    <span className="text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded">{c.sectionHeader}</span>
                  )}
                  {c.priority && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[c.priority]}`}>
                      {c.priority}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">p.{c.page}</span>
                  {info && (
                    <span className={`text-[10px] font-bold ${info.rate >= 0.7 ? "text-emerald-500" : "text-red-400"}`}>
                      {info.pct}% ({info.correct}/{info.total})
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">該当なし</p>
        )}
      </div>
    </div>
  );
}
