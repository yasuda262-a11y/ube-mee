"use client";

import { useState, useMemo } from "react";
import { Search, CheckCircle, XCircle, Minus } from "lucide-react";
import type { Question } from "../data/questions";
import type { StatsRecord } from "../lib/stats";

interface Props {
  questions: Question[];
  stats: StatsRecord;
  onStartFrom: (question: Question) => void;
}

export default function QuestionList({ questions, stats, onStartFrom }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "weak" | "unanswered">("all");

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const s = stats[q.id];
      if (filter === "weak") {
        if (!s || s.total === 0) return false;
        return s.correct / s.total < 0.7;
      }
      if (filter === "unanswered") return !s || s.total === 0;
      if (query) {
        const lq = query.toLowerCase();
        return q.answer.toLowerCase().includes(lq) || q.context.toLowerCase().includes(lq);
      }
      return true;
    });
  }, [questions, stats, filter, query]);

  function rateLabel(id: number) {
    const s = stats[id];
    if (!s || s.total === 0) return null;
    const rate = s.correct / s.total;
    return { rate, pct: Math.round(rate * 100), correct: s.correct, total: s.total };
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 検索 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      {/* フィルタータブ */}
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
        {filtered.map((q) => {
          const info = rateLabel(q.id);
          const preview = q.context.replace("__BLANK__", "[ ? ]").slice(0, 80) + "…";
          return (
            <button
              key={q.id}
              onClick={() => onStartFrom(q)}
              className="bg-white rounded-2xl border border-gray-100 px-4 py-3 text-left flex items-start gap-3 hover:border-indigo-200 hover:bg-indigo-50 transition-colors active:scale-95"
            >
              {/* 正誤アイコン */}
              <div className="mt-0.5 flex-shrink-0">
                {!info
                  ? <Minus size={15} className="text-gray-300" />
                  : info.rate >= 0.7
                  ? <CheckCircle size={15} className="text-emerald-400" />
                  : <XCircle size={15} className="text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-indigo-500 font-semibold mb-0.5">{q.answer}</p>
                <p className="text-xs text-gray-500 leading-5 line-clamp-2">{preview}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded">{q.subject}</span>
                  <span className="text-[10px] text-gray-400">p.{q.page}</span>
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
