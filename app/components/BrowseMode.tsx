"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Card } from "../data/questions";
import { renderRichText } from "../lib/richText";

interface Props {
  cards: Card[];
  subjectIndex: Map<number, number>;
  selectedSubject: string | null;
}

/** __BLANK_N__ を答えテキスト（++underline++）に置換して全展開テキストを返す */
function fillBlanks(context: string, blanks: Card["blanks"]): string {
  let result = context;
  // 降順に置換（インデックスが後の方から置換してずれを防ぐため番号順は問わない）
  for (const blank of blanks) {
    result = result.replace(
      new RegExp(`__BLANK_${blank.idx}__`, "g"),
      `++${blank.answer}++`
    );
  }
  return result;
}

function BrowseCard({ card, number }: { card: Card; number: number }) {
  const [open, setOpen] = useState(false);
  const filledText = useMemo(() => fillBlanks(card.context, card.blanks), [card]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ヘッダー行 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex-shrink-0 mt-0.5 text-[11px] font-bold text-white bg-gray-400 rounded-full w-5 h-5 flex items-center justify-center">
          {number}
        </span>
        <div className="flex-1 min-w-0">
          {card.sectionHeader && (
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide truncate">
              {card.sectionHeader}
            </p>
          )}
          {card.subsectionTitle && (
            <p className="text-[11px] text-gray-500 truncate">{card.subsectionTitle}</p>
          )}
          {/* 折りたたみ時：contextの先頭を1行プレビュー */}
          {!open && (
            <p className="text-xs text-gray-700 mt-0.5 line-clamp-1">
              {card.context.replace(/__BLANK_\d+__/g, "…").replace(/\*\*|\+\+/g, "").slice(0, 80)}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-gray-400 mt-0.5">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {/* 展開コンテンツ */}
      {open && (
        <div className="px-4 pb-4 border-t border-gray-50">
          {/* 英文（全展開） */}
          <div className="mt-3 text-sm text-gray-800 leading-relaxed">
            {renderRichText(filledText)}
          </div>

          {/* 和訳 */}
          {card.translation && (
            <div className="mt-3 pt-3 border-t border-sky-100">
              <p className="text-[10px] font-semibold text-sky-500 mb-1">🇯🇵 和訳</p>
              <div className="text-xs text-gray-600 leading-relaxed">
                {renderRichText(card.translation)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrowseMode({ cards, subjectIndex, selectedSubject }: Props) {
  const [expandAll, setExpandAll] = useState(false);

  // expandAll が変わったら全カードに反映させるためにキーでリセット
  const listKey = expandAll ? "expanded" : "collapsed";

  return (
    <div className="flex flex-col gap-3">
      {/* コントロールバー */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {selectedSubject ?? "すべての科目"} · {cards.length}枚
        </p>
        <button
          type="button"
          onClick={() => setExpandAll((v) => !v)}
          className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-xl px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          {expandAll ? "すべて折りたたむ" : "すべて展開"}
        </button>
      </div>

      {/* カードリスト */}
      <div key={listKey} className="flex flex-col gap-2">
        {cards.map((card) => (
          <BrowseCard
            key={card.id}
            card={card}
            number={subjectIndex.get(card.id) ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
