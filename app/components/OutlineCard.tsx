"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { MeeCard } from "../data/mee-outline";
import { renderRichText } from "../lib/richText";

// ---- 優先度バッジ ----
const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "bg-red-100",    text: "text-red-700",    label: "HIGH" },
  MED:  { bg: "bg-orange-100", text: "text-orange-600", label: "MED"  },
  LOW:  { bg: "bg-green-100",  text: "text-green-700",  label: "LOW"  },
};

// ---- 科目テーマ ----
const SUBJECT_ACCENT: Record<string, string> = {
  "AGENCY":                    "#7c3aed",
  "CONTRACTS":                 "#2563eb",
  "TORTS":                     "#f97316",
  "CONSTITUTIONAL LAW":        "#dc2626",
  "CRIMINAL LAW & PROCEDURE":  "#be123c",
  "CIVIL PROCEDURE":           "#0891b2",
  "EVIDENCE":                  "#059669",
  "REAL PROPERTY":             "#d97706",
  "CORPORATIONS & LLC'S":      "#4f46e5",
  "PARTNERSHIPS":              "#0d9488",
};
function subjectAccent(s: string) { return SUBJECT_ACCENT[s] ?? "#6366f1"; }

// ---- 本文レンダラー（bullet構造対応） ----
function renderOutlineBody(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="flex-shrink-0 mt-[3px] text-gray-400">•</span>
              <span>{renderRichText(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (trimmed.startsWith("  ○ ") || trimmed.startsWith("○ ")) {
          const content = trimmed.replace(/^○\s*/, "").replace(/^\s*○\s*/, "");
          return (
            <div key={i} className="flex gap-2 pl-4">
              <span className="flex-shrink-0 mt-[3px] text-gray-300 text-xs">○</span>
              <span className="text-sm">{renderRichText(content)}</span>
            </div>
          );
        }
        if (!trimmed) return <div key={i} className="h-1" />;
        return <div key={i}>{renderRichText(trimmed)}</div>;
      })}
    </div>
  );
}

interface Props {
  card: MeeCard;
  index: number;    // 0-based
  total: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function OutlineCard({ card, index, total, onPrev, onNext, hasPrev, hasNext }: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const accent = subjectAccent(card.subject);
  const pStyle = card.priority ? PRIORITY_STYLE[card.priority] : null;

  return (
    <div className="bg-white rounded-3xl shadow-md overflow-hidden" style={{ border: `1px solid ${accent}22` }}>
      {/* カラーバー */}
      <div className="h-1.5" style={{ background: accent }} />

      <div className="p-4 flex flex-col gap-3">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">
              {card.subject} › {card.section}
            </p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5 leading-snug">
              {card.ruleTitle}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {pStyle && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pStyle.bg} ${pStyle.text}`}>
                {pStyle.label}
              </span>
            )}
            {card.frequency && (
              <span className="text-[10px] text-gray-500 whitespace-nowrap">{card.frequency}</span>
            )}
          </div>
        </div>

        {/* 本文 */}
        <div className="text-sm text-gray-800 leading-relaxed">
          {renderOutlineBody(card.body)}
        </div>

        {/* MEE TIP */}
        {card.meeTips.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 mb-1">💡 MEE TIP</p>
            {card.meeTips.map((tip, i) => (
              <p key={i} className="text-xs text-amber-800 leading-relaxed">
                {renderRichText(tip)}
              </p>
            ))}
          </div>
        )}

        {/* 出題履歴 */}
        {card.examHistory.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar size={11} className="text-slate-500" />
              <p className="text-[10px] font-bold text-slate-500">出題履歴</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {card.examHistory.map((e, i) => (
                <span key={i} className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-600">
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 和訳トグル */}
        {card.translation && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-sky-600"
            >
              <span>🇯🇵 和訳</span>
              <span>{showTranslation ? "▲ 閉じる" : "▼ 表示"}</span>
            </button>
            {showTranslation && (
              <div className="px-3 pb-3 text-sm text-gray-700 leading-relaxed border-t border-sky-100">
                {renderOutlineBody(card.translation)}
                {card.meeTipTranslation && (
                  <div className="mt-2 pt-2 border-t border-sky-100">
                    <p className="text-[10px] font-bold text-amber-600 mb-1">💡 MEE TIP（和訳）</p>
                    <p className="text-xs text-amber-800">{renderRichText(card.meeTipTranslation)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ナビゲーション */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: hasPrev ? accent : undefined }}
          >
            <ChevronLeft size={16} /> 前へ
          </button>
          <span className="text-xs text-gray-400 font-medium">
            {index + 1} / {total}
          </span>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: hasNext ? accent : undefined }}
          >
            次へ <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
