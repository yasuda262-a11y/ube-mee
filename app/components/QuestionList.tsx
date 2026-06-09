"use client";

import { useState, useMemo } from "react";
import { Search, CheckCircle, XCircle, Minus } from "lucide-react";
import type { Card } from "../data/questions";
import { SUBJECTS } from "../data/questions";
import type { StatsRecord } from "../lib/stats";

const PRIORITY_COLOR: Record<string, string> = {
  H: "text-red-500 bg-red-50 border-red-200",
  M: "text-orange-500 bg-orange-50 border-orange-200",
  L: "text-yellow-600 bg-yellow-50 border-yellow-200",
};

// ホーム画面の科目カラーと統一
const SUBJECT_COLORS: Record<string, string> = {
  "AGENCY":                "bg-violet-100 text-violet-700",
  "CONTRACTS":             "bg-blue-100 text-blue-700",
  "TORTS":                 "bg-orange-100 text-orange-700",
  "CONSTITUTIONAL LAW":    "bg-red-100 text-red-700",
  "CRIMINAL LAW & PROCEDURE": "bg-rose-100 text-rose-800",
  "CIVIL PROCEDURE":       "bg-cyan-100 text-cyan-700",
  "EVIDENCE":              "bg-emerald-100 text-emerald-700",
  "REAL PROPERTY":         "bg-amber-100 text-amber-700",
  "CORPORATIONS & LLC'S":  "bg-indigo-100 text-indigo-700",
  "PARTNERSHIPS":          "bg-teal-100 text-teal-700",
};
function subjectCls(s: string) {
  return SUBJECT_COLORS[s] ?? "bg-gray-100 text-gray-600";
}

// 科目タブのアクティブ時のソリッド色
const SUBJECT_ACTIVE: Record<string, string> = {
  "AGENCY":                "bg-violet-600 text-white",
  "CONTRACTS":             "bg-blue-600 text-white",
  "TORTS":                 "bg-orange-500 text-white",
  "CONSTITUTIONAL LAW":    "bg-red-600 text-white",
  "CRIMINAL LAW & PROCEDURE": "bg-rose-700 text-white",
  "CIVIL PROCEDURE":       "bg-cyan-600 text-white",
  "EVIDENCE":              "bg-emerald-600 text-white",
  "REAL PROPERTY":         "bg-amber-600 text-white",
  "CORPORATIONS & LLC'S":  "bg-indigo-600 text-white",
  "PARTNERSHIPS":          "bg-teal-600 text-white",
};
function subjectActiveCls(s: string) {
  return SUBJECT_ACTIVE[s] ?? "bg-gray-600 text-white";
}

interface Props {
  cards: Card[];
  stats: StatsRecord;
  onStartFrom: (card: Card) => void;
}

export default function QuestionList({ cards, stats, onStartFrom }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "weak" | "unanswered">("all");
  const [subject, setSubject] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (subject && c.subject !== subject) return false;
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
  }, [cards, stats, filter, query, subject]);

  function rateInfo(id: number) {
    const s = stats[id];
    if (!s || s.total === 0) return null;
    return { rate: s.correct / s.total, pct: Math.round((s.correct / s.total) * 100), correct: s.correct, total: s.total };
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 科目タブ（折り返し表示・全件一覧） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSubject(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            !subject ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          すべて
        </button>
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubject(subject === s ? null : s)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              subject === s ? subjectActiveCls(s) : `${subjectCls(s)} hover:opacity-80`
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* キーワード検索 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="キーワードで検索..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-indigo-400 bg-white"
        />
      </div>

      {/* 絞り込みタブ */}
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

      <div className="flex flex-col gap-2">
        {filtered.map((c) => {
          const info = rateInfo(c.id);
          const preview = c.context.replace(/__BLANK_\d+__/g, "[ ? ]").slice(0, 100) + "…";
          const answers = c.blanks.map((b) => b.answer).join(" / ");
          return (
            <button
              key={c.id}
              onClick={() => onStartFrom(c)}
              className="w-full bg-white rounded-2xl border border-gray-100 px-4 py-3.5 text-left flex items-start gap-3 hover:border-indigo-200 hover:bg-indigo-50 transition-colors active:scale-[0.99]"
            >
              {/* 正誤アイコン */}
              <div className="mt-1 flex-shrink-0">
                {!info
                  ? <Minus size={15} className="text-gray-300" />
                  : info.rate >= 0.7
                  ? <CheckCircle size={15} className="text-emerald-400" />
                  : <XCircle size={15} className="text-red-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {/* 答え */}
                <p className="text-xs text-indigo-500 font-semibold mb-1 truncate">{answers}</p>

                {/* コンテキストプレビュー */}
                <p className="text-xs text-gray-600 leading-5 line-clamp-2 mb-2">{preview}</p>

                {/* タグ行 */}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {/* 科目 */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${subjectCls(c.subject)}`}>
                    {c.subject}
                  </span>

                  {/* 大項目 */}
                  {c.sectionHeader && (
                    <span className="text-[10px] bg-gray-800 text-white px-1.5 py-0.5 rounded-full">
                      {c.sectionHeader}
                    </span>
                  )}

                  {/* 中項目 ★新規追加 */}
                  {c.subsectionTitle && (
                    <span className="text-[10px] bg-gray-600 text-gray-100 px-1.5 py-0.5 rounded-full">
                      {c.subsectionTitle}
                    </span>
                  )}

                  {/* 優先度 */}
                  {c.priority && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORITY_COLOR[c.priority]}`}>
                      {c.priority}
                    </span>
                  )}

                  {/* ページ */}
                  <span className="text-[10px] text-gray-400">p.{c.page}</span>

                  {/* 正答率 */}
                  {info && (
                    <span className={`text-[10px] font-bold ml-auto ${info.rate >= 0.7 ? "text-emerald-500" : "text-red-400"}`}>
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
