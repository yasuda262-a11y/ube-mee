"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar, Flag, StickyNote } from "lucide-react";
import type { MeeCard } from "../data/mee-outline";
import { renderRichText, renderRichTextWithHighlights, getPlainText } from "../lib/richText";
import { getCardData, setFlag, setMemo, toggleHighlight } from "../lib/outlineUserData";

// ---- 科目テーマ（背景・アクセント）----
const SUBJECT_THEME: Record<string, { accent: string; bg: string; border: string; badge: string }> = {
  "AGENCY":                   { accent: "#7c3aed", bg: "bg-violet-50",  border: "border-violet-100", badge: "bg-violet-100 text-violet-700" },
  "PARTNERSHIPS":             { accent: "#0d9488", bg: "bg-teal-50",    border: "border-teal-100",   badge: "bg-teal-100 text-teal-700" },
  "CORPORATIONS & LLC'S":     { accent: "#4f46e5", bg: "bg-indigo-50",  border: "border-indigo-100", badge: "bg-indigo-100 text-indigo-700" },
  "CIVIL PROCEDURE":          { accent: "#0891b2", bg: "bg-cyan-50",    border: "border-cyan-100",   badge: "bg-cyan-100 text-cyan-700" },
  "CONSTITUTIONAL LAW":       { accent: "#dc2626", bg: "bg-red-50",     border: "border-red-100",    badge: "bg-red-100 text-red-700" },
  "CONTRACTS":                { accent: "#2563eb", bg: "bg-blue-50",    border: "border-blue-100",   badge: "bg-blue-100 text-blue-700" },
  "CRIMINAL LAW & PROCEDURE": { accent: "#be123c", bg: "bg-rose-50",    border: "border-rose-100",   badge: "bg-rose-100 text-rose-700" },
  "EVIDENCE":                 { accent: "#059669", bg: "bg-emerald-50", border: "border-emerald-100",badge: "bg-emerald-100 text-emerald-700" },
  "REAL PROPERTY":            { accent: "#d97706", bg: "bg-amber-50",   border: "border-amber-100",  badge: "bg-amber-100 text-amber-700" },
  "TORTS":                    { accent: "#f97316", bg: "bg-orange-50",  border: "border-orange-100", badge: "bg-orange-100 text-orange-700" },
};
function theme(s: string) {
  return SUBJECT_THEME[s] ?? { accent: "#6366f1", bg: "bg-slate-50", border: "border-slate-100", badge: "bg-slate-100 text-slate-700" };
}

// ---- 優先度バッジ ----
const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "bg-red-100",    text: "text-red-700",    label: "HIGH" },
  MED:  { bg: "bg-orange-100", text: "text-orange-600", label: "MED"  },
  LOW:  { bg: "bg-green-100",  text: "text-green-700",  label: "LOW"  },
};

// ---- 出題履歴ソート（新しい順）----
const MONTH_NUM: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
function parseHistoryDate(s: string): number {
  const m = s.match(/([A-Za-z]+)\.?\s*(\d{4})/);
  if (!m) return 0;
  return parseInt(m[2]) * 12 + (MONTH_NUM[m[1]] ?? 0);
}

// ---- ハイライトキー ----
// 形式: "phrase" (全出現) または "phrase|||CTX_BEFORE" (特定出現)
const HL_SEP = "|||";

function parseHlKey(h: string): { phrase: string; ctxBefore: string | null } {
  const i = h.indexOf(HL_SEP);
  if (i === -1) return { phrase: h, ctxBefore: null };
  return { phrase: h.slice(0, i), ctxBefore: h.slice(i + HL_SEP.length) };
}

function normalizeCtx(s: string) { return s.replace(/[•○◦]/g, "").replace(/\s+/g, " "); }

/**
 * rawLine をmarkdownパース → セグメントツリー上でハイライト範囲を適用してレンダリング。
 * bold/italic マーカーを壊さずにハイライトを挿入できる。
 * accBefore: このライン以前のプレーンテキスト累積（コンテキスト照合用）
 */
function renderLineWithHighlights(rawLine: string, highlights: string[], accBefore: string): React.ReactNode {
  if (!highlights.length) return renderRichText(rawLine);

  // プレーンテキストはパーサーと同じロジックで抽出（getPlainText使用）
  const plain = getPlainText(rawLine);

  const hlRanges: { s: number; e: number }[] = [];
  for (const h of highlights) {
    const { phrase, ctxBefore } = parseHlKey(h);
    if (!phrase.trim()) continue;
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain)) !== null) {
      if (ctxBefore !== null) {
        const textBefore = normalizeCtx(accBefore + plain.slice(0, m.index));
        if (!textBefore.endsWith(normalizeCtx(ctxBefore))) continue;
      }
      hlRanges.push({ s: m.index, e: m.index + m[0].length });
    }
  }

  return renderRichTextWithHighlights(rawLine, hlRanges);
}

// ---- 本文レンダラー ----
function OutlineBodyRenderer({ text, highlights, accBefore: initAcc = "" }: { text: string; highlights: string[]; accBefore?: string }) {
  if (!text) return null;
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let acc = initAcc;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (!trimmed) {
      nodes.push(<div key={i} className="h-1" />);
      continue;
    }

    let renderContent: string;
    let node: React.ReactNode;

    if (trimmed.startsWith("• ")) {
      renderContent = trimmed.slice(2);
      node = (
        <div key={i} className="flex gap-2">
          <span className="flex-shrink-0 mt-[3px] text-gray-400">•</span><span>{renderLineWithHighlights(renderContent, highlights, acc)}</span>
        </div>
      );
    } else if (trimmed.startsWith("  ○ ") || trimmed.startsWith("○ ")) {
      renderContent = trimmed.replace(/^\s*○\s*/, "");
      node = (
        <div key={i} className="flex gap-2 pl-6">
          <span className="flex-shrink-0 mt-[3px] text-gray-400">○</span><span>{renderLineWithHighlights(renderContent, highlights, acc)}</span>
        </div>
      );
    } else if (line.startsWith("    ") && !trimmed.startsWith("○")) {
      renderContent = trimmed;
      node = <div key={i} className="pl-12 text-gray-700">{renderLineWithHighlights(renderContent, highlights, acc)}</div>;
    } else if (line.startsWith("  ") && !trimmed.startsWith("○")) {
      renderContent = trimmed;
      node = <div key={i} className="pl-6 text-gray-700">{renderLineWithHighlights(renderContent, highlights, acc)}</div>;
    } else {
      renderContent = trimmed;
      node = <div key={i}>{renderLineWithHighlights(renderContent, highlights, acc)}</div>;
    }

    nodes.push(node);
    acc += getPlainText(renderContent);
  }

  return <div className="space-y-1.5">{nodes}</div>;
}

// ---- 選択ポップアップ ----
interface SelectionPopup { text: string; hlKey: string; x: number; y: number; already: boolean }

interface Props {
  card: MeeCard;
  index: number;
  total: number;
  subjectTotal: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function OutlineCard({ card, index, total, subjectTotal, onPrev, onNext, hasPrev, hasNext }: Props) {
  const [showTranslation, setShowTranslation] = useState(true);
  const [showMemo, setShowMemo] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [memo, setMemoText] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [popup, setPopup] = useState<SelectionPopup | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyContentRef = useRef<HTMLDivElement>(null);
  const translationContentRef = useRef<HTMLDivElement>(null);

  const t = theme(card.subject);
  const pStyle = card.priority ? PRIORITY_STYLE[card.priority] : null;

  const sortedHistory = useMemo(
    () => [...card.examHistory].sort((a, b) => parseHistoryDate(b) - parseHistoryDate(a)),
    [card.examHistory]
  );

  useEffect(() => {
    const data = getCardData(card.subject, card.id);
    setFlagged(data.flag);
    setMemoText(data.memo);
    setHighlights(data.highlights ?? []);
    setShowTranslation(true);
    setPopup(null);
  }, [card.subject, card.id]);

  const handleSelectionEnd = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setPopup(null); return; }
      const text = sel.toString().trim();
      if (!text || text.length < 2) { setPopup(null); return; }
      if (!cardRef.current) return;
      const range = sel.getRangeAt(0);
      if (!cardRef.current.contains(range.commonAncestorContainer)) { setPopup(null); return; }

      // 選択直前のコンテキスト20文字を取得して出現箇所を特定
      // 本文・和訳それぞれの専用refを基点にしてUI文字の混入を防ぐ
      let ctxBefore = "";
      try {
        const contentRoot =
          bodyContentRef.current?.contains(range.startContainer)
            ? bodyContentRef.current
            : translationContentRef.current?.contains(range.startContainer)
            ? translationContentRef.current
            : null;
        if (contentRoot) {
          const measRange = document.createRange();
          measRange.setStart(contentRoot, 0);
          measRange.setEnd(range.startContainer, range.startOffset);
          ctxBefore = normalizeCtx(measRange.toString()).slice(-20);
        }
      } catch {}
      const hlKey = ctxBefore ? `${text}${HL_SEP}${ctxBefore}` : text;

      const rect = range.getBoundingClientRect();
      const already = highlights.some((h) => h === hlKey);
      setPopup({ text, hlKey, x: rect.left + rect.width / 2, y: rect.top - 8, already });
    }, 50);
  }, [highlights]);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelectionEnd);
    document.addEventListener("touchend", handleSelectionEnd);
    return () => {
      document.removeEventListener("mouseup", handleSelectionEnd);
      document.removeEventListener("touchend", handleSelectionEnd);
    };
  }, [handleSelectionEnd]);

  useEffect(() => {
    const close = () => { if (!window.getSelection()?.toString().trim()) setPopup(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleHighlightAction = useCallback(() => {
    if (!popup) return;
    const next = toggleHighlight(card.subject, card.id, popup.hlKey);
    setHighlights(Array.from(next));
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }, [popup, card.subject, card.id]);

  const handleFlag = useCallback(() => {
    const next = !flagged;
    setFlagged(next);
    setFlag(card.subject, card.id, next);
  }, [flagged, card.subject, card.id]);

  const handleMemo = useCallback((v: string) => {
    setMemoText(v);
    setMemo(card.subject, card.id, v);
  }, [card.subject, card.id]);

  const clearAllHighlights = useCallback(() => {
    highlights.forEach((h) => toggleHighlight(card.subject, card.id, h));
    setHighlights([]);
  }, [highlights, card.subject, card.id]);

  return (
    <div
      className={`rounded-3xl shadow-sm overflow-hidden border ${t.bg} ${t.border}`}
    >
      {/* カラーバー */}
      <div className="h-1.5" style={{ background: t.accent }} />

      {/* 選択ポップアップ — overflow-hidden の外側にPortalでレンダリング */}
      {popup && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-[9999] -translate-x-1/2 -translate-y-full flex gap-1 bg-gray-900 rounded-xl px-2 py-1.5 shadow-xl"
          style={{ left: popup.x, top: popup.y }}
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleHighlightAction(); }}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg ${
              popup.already ? "text-red-300 hover:text-red-200" : "text-yellow-300 hover:text-yellow-200"
            }`}
          >
            {popup.already ? "✕ 解除" : "🖊 ハイライト"}
          </button>
        </div>,
        document.body
      )}

      <div ref={cardRef} className="p-4 flex flex-col select-text">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">
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
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>
              #{card.id} / {subjectTotal}
            </span>
            {card.frequency && (
              <span className="text-[10px] text-gray-500 whitespace-nowrap">{card.frequency}</span>
            )}
          </div>
        </div>

        {/* 本文 */}
        <div ref={bodyContentRef} className="mt-1.5 text-sm text-gray-800 leading-relaxed">
          <OutlineBodyRenderer text={card.body} highlights={highlights} />
        </div>

        {/* MEE TIP */}
        {card.meeTips.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 mb-1">💡 MEE TIP</p>
            {card.meeTips.map((tip, i) => (
              <p key={i} className="text-xs text-amber-800 leading-relaxed">
                {renderLineWithHighlights(tip, highlights, "")}
              </p>
            ))}
          </div>
        )}

        {/* 出題履歴 */}
        {sortedHistory.length > 0 && (
          <div className="mt-3 rounded-xl bg-white/60 border border-gray-100 px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Calendar size={11} className="text-slate-500" />
              <p className="text-[10px] font-bold text-slate-500">出題履歴</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {sortedHistory.map((e, i) => (
                <span key={i} className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-slate-600">
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 和訳トグル */}
        {card.translation && (
          <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTranslation((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-sky-600"
            >
              <span>🇯🇵 和訳</span>
              <span>{showTranslation ? "▲ 閉じる" : "▼ 表示"}</span>
            </button>
            {showTranslation && (
              <div ref={translationContentRef} className="px-3 pb-3 text-xs text-gray-700 leading-relaxed border-t border-sky-100 space-y-2">
                {card.ruleTitleJa && (
                  <p className="font-bold text-sky-800 pt-1">{card.ruleTitleJa}</p>
                )}
                <OutlineBodyRenderer
                  text={card.translation}
                  highlights={highlights}
                  accBefore={card.ruleTitleJa ? card.ruleTitleJa : ""}
                />
                {card.meeTipTranslation && (
                  <div className="pt-2 border-t border-sky-100">
                    <p className="text-[10px] font-bold text-amber-600 mb-1">💡 MEE TIP（和訳）</p>
                    <p className="text-amber-800">
                      {renderLineWithHighlights(Array.isArray(card.meeTipTranslation) ? card.meeTipTranslation.join("\n") : card.meeTipTranslation, highlights, "")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ハイライト消去 */}
        {highlights.length > 0 && (
          <button
            type="button"
            onClick={clearAllHighlights}
            className="self-end text-[10px] text-gray-400 hover:text-red-400 underline"
          >
            ハイライトを全て消去
          </button>
        )}

        {/* メモ欄 */}
        <div className="mt-3 rounded-2xl border border-gray-200 bg-white/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMemo((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-gray-500"
          >
            <span className="flex items-center gap-1.5">
              <StickyNote size={12} />
              メモ
              {memo && <span className="text-[10px] bg-yellow-200 text-yellow-700 rounded px-1">あり</span>}
            </span>
            <span>{showMemo ? "▲" : "▼"}</span>
          </button>
          {showMemo && (
            <div className="px-3 pb-3 border-t border-gray-200">
              <textarea
                value={memo}
                onChange={(e) => handleMemo(e.target.value)}
                placeholder="メモを入力..."
                rows={3}
                className="w-full mt-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: hasPrev ? t.accent : undefined }}
          >
            <ChevronLeft size={16} /> 前へ
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={handleFlag}
              className={`p-1.5 rounded-lg transition-colors ${
                flagged ? "text-red-500 bg-red-50" : "text-gray-300 hover:text-gray-400"
              }`}
            >
              <Flag size={14} fill={flagged ? "currentColor" : "none"} />
            </button>
          </div>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: hasNext ? t.accent : undefined }}
          >
            次へ <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
