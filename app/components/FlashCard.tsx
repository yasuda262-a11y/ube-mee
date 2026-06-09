"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, CheckCircle, XCircle, Eye, Pencil, RotateCcw } from "lucide-react";
import type { Card } from "../data/questions";
import {
  parseTokens,
  getOverride,
  saveOverride,
  resetOverride,
  toggleToken,
  getEffectiveBlankedSet,
  type Token,
  type BlankOverride,
} from "../lib/customBlanks";

interface Props {
  card: Card;
  cardNumber: number;
  total: number;
  onResult: (results: boolean[]) => void;
  onNext: () => void;
}

const PRIORITY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  H: { label: "High",   color: "text-red-600",    bg: "bg-red-50 border-red-200"    },
  M: { label: "Middle", color: "text-orange-500",  bg: "bg-orange-50 border-orange-200" },
  L: { label: "Low",    color: "text-yellow-600",  bg: "bg-yellow-50 border-yellow-200" },
};

function judge(input: string, answer: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const u = norm(input), a = norm(answer);
  if (!u) return false;
  if (u === a) return true;
  const stop = new Set(["a","an","the","of","in","on","to","is","are","or","and","by","that","it","be","at","as"]);
  const kws = a.split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  if (kws.length === 0) return a.includes(u) || u.includes(a);
  return kws.filter(kw => u.includes(kw)).length >= Math.ceil(kws.length * 0.6);
}

function isListStartText(text: string): boolean {
  return /^(\d+[).]\s*|[a-z][).]\s*|[ivxlcdm]+[).]\s*|[−–•])/.test(text);
}

// ---- Token separator helper -----------------------------------------------

/** 2 つの連続トークン間に挿入する区切り要素を返す */
function separator(prev: Token, cur: Token, key: string): React.ReactNode {
  if (prev.lineIdx === cur.lineIdx) {
    return <span key={key}> </span>;
  }
  // 行をまたぐ場合
  if (prev.text.endsWith("-")) {
    return null; // ハイフン連結: スペースなし
  }
  const curText = cur.type === "word" ? cur.text : "";
  if (isListStartText(curText)) {
    return <br key={key} />;
  }
  return <span key={key}> </span>;
}

// ---- Study mode renderer --------------------------------------------------

type TokenInputState = {
  state: "unanswered" | "correct" | "incorrect";
};

function StudyTokens({
  tokens,
  blankedSet,
  disabledOriginals,
  inputStates,
  blankNumberMap,
}: {
  tokens: Token[];
  blankedSet: Set<number>;
  disabledOriginals: Set<number>;
  inputStates: Map<number, TokenInputState>; // tokenIdx → state
  blankNumberMap: Map<number, number>;        // tokenIdx → 1-based 番号
}) {
  const nodes: React.ReactNode[] = [];
  let prev: Token | null = null;

  for (const t of tokens) {
    if (prev !== null) {
      const sep = separator(prev, t, `sep-${t.idx}`);
      if (sep) nodes.push(sep);
    }

    if (blankedSet.has(t.idx)) {
      const st = inputStates.get(t.idx)?.state ?? "unanswered";
      const num = blankNumberMap.get(t.idx);
      // 番号ラベル（上付きではなく小さいインラインテキスト）
      const numLabel = (
        <span className="text-[10px] font-bold text-indigo-400 select-none mr-0.5 align-baseline">
          ({num})
        </span>
      );
      if (st === "unanswered") {
        const em = Math.min(24, Math.max(4, Math.round(t.text.length * 0.6)));
        nodes.push(
          <span key={t.idx} className="inline-block align-baseline mx-0.5 whitespace-nowrap">
            {numLabel}
            <span
              className="inline-block bg-gray-200 text-gray-200 rounded px-1.5 select-none align-middle"
              style={{ minWidth: `${em}em` }}>_</span>
          </span>
        );
      } else if (st === "correct") {
        nodes.push(
          <span key={t.idx} className="inline-block align-baseline mx-0.5 whitespace-nowrap">
            {numLabel}
            <span className="inline-block bg-emerald-100 text-emerald-800 font-semibold rounded px-1.5 align-middle">
              {t.text}
            </span>
          </span>
        );
      } else {
        nodes.push(
          <span key={t.idx} className="inline-block align-baseline mx-0.5 whitespace-nowrap">
            {numLabel}
            <span className="inline-block bg-red-100 text-red-700 font-semibold rounded px-1.5 align-middle">
              {t.text}
            </span>
          </span>
        );
      }
    } else if (t.type === "originalBlank" && disabledOriginals.has(t.blankIdx!)) {
      nodes.push(
        <span key={t.idx} className="text-gray-400 italic">{t.text}</span>
      );
    } else {
      nodes.push(<span key={t.idx}>{t.text}</span>);
    }
    prev = t;
  }

  return <>{nodes}</>;
}

// ---- Edit mode renderer ---------------------------------------------------

function EditTokens({
  tokens,
  blankedSet,
  disabledOriginals,
  customSet,
  onToggle,
}: {
  tokens: Token[];
  blankedSet: Set<number>;
  disabledOriginals: Set<number>;
  customSet: Set<number>;
  onToggle: (t: Token) => void;
}) {
  const nodes: React.ReactNode[] = [];
  let prev: Token | null = null;

  for (const t of tokens) {
    if (prev !== null) {
      const sep = separator(prev, t, `sep-${t.idx}`);
      if (sep) nodes.push(sep);
    }

    if (t.type === "originalBlank") {
      const isOff = disabledOriginals.has(t.blankIdx!);
      nodes.push(
        <button
          key={t.idx}
          type="button"
          onClick={() => onToggle(t)}
          title={isOff ? "クリックして伏字に戻す" : "クリックして伏字を解除"}
          className={`inline rounded px-1 py-0.5 text-[14px] leading-7 font-medium transition-colors cursor-pointer ${
            isOff
              ? "bg-gray-100 text-gray-400 line-through"
              : "bg-indigo-100 text-indigo-800 border-b-2 border-indigo-400"
          }`}
        >
          {t.text}
        </button>
      );
    } else {
      // word token
      const isCustom = customSet.has(t.idx);
      nodes.push(
        <button
          key={t.idx}
          type="button"
          onClick={() => onToggle(t)}
          title={isCustom ? "クリックして伏字を解除" : "クリックして伏字に追加"}
          className={`inline rounded px-1 py-0.5 text-[14px] leading-7 transition-colors cursor-pointer ${
            isCustom
              ? "bg-amber-100 text-amber-800 border-b-2 border-amber-400 font-medium"
              : "hover:bg-gray-100 text-gray-700"
          }`}
        >
          {t.text}
        </button>
      );
    }
    prev = t;
  }

  return <>{nodes}</>;
}

// ---- Main component -------------------------------------------------------

export default function FlashCard({ card, cardNumber, total, onResult, onNext }: Props) {
  const [override, setOverride] = useState<BlankOverride>({
    disabledOriginalBlanks: [],
    customBlankedTokens: [],
  });
  const [inputs, setInputs] = useState<Map<number, string>>(new Map()); // tokenIdx → input
  const [inputStates, setInputStates] = useState<Map<number, TokenInputState>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const inputRefs = useRef<Map<number, HTMLInputElement | null>>(new Map());

  // tokens は card が変わったときのみ再計算
  const tokens = useMemo(() => parseTokens(card.context, card.blanks), [card.id]);

  // blankedSet / disabledOriginals / customSet は override が変わるたびに再計算
  const blankedSet = useMemo(
    () => getEffectiveBlankedSet(tokens, override),
    [tokens, override]
  );
  const disabledOriginals = useMemo(
    () => new Set(override.disabledOriginalBlanks),
    [override]
  );
  const customSet = useMemo(
    () => new Set(override.customBlankedTokens),
    [override]
  );

  // アクティブな blank token（伏字として出題される順序リスト）
  const activeBlanks = useMemo(
    () => tokens.filter((t) => blankedSet.has(t.idx)),
    [tokens, blankedSet]
  );

  // tokenIdx → 1-based 番号（コンテキスト内の (1)(2)... 表示用）
  const blankNumberMap = useMemo(() => {
    const m = new Map<number, number>();
    activeBlanks.forEach((t, i) => m.set(t.idx, i + 1));
    return m;
  }, [activeBlanks]);

  // カード切り替え時リセット
  useEffect(() => {
    const ov = getOverride(card.id);
    setOverride(ov);
    setInputs(new Map());
    setInputStates(new Map());
    setSubmitted(false);
    setEditMode(false);
    // 最初の入力欄にフォーカス
    setTimeout(() => {
      const first = inputRefs.current.values().next().value;
      first?.focus();
    }, 50);
  }, [card.id]);

  function handleToggleToken(t: Token) {
    const next = toggleToken(t, override);
    setOverride(next);
    saveOverride(card.id, next);
  }

  function handleReset() {
    resetOverride(card.id);
    setOverride({ disabledOriginalBlanks: [], customBlankedTokens: [] });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    const newStates = new Map<number, TokenInputState>();
    const results: boolean[] = [];
    for (const t of activeBlanks) {
      const input = inputs.get(t.idx) ?? "";
      const correct = judge(input, t.text);
      newStates.set(t.idx, { state: correct ? "correct" : "incorrect" });
      results.push(correct);
    }
    setInputStates(newStates);
    setSubmitted(true);
    onResult(results);
  }

  function handleReveal() {
    if (submitted) return;
    const newStates = new Map<number, TokenInputState>();
    for (const t of activeBlanks) {
      newStates.set(t.idx, { state: "incorrect" });
    }
    setInputStates(newStates);
    setSubmitted(true);
    onResult(activeBlanks.map(() => false));
  }

  const correctCount = [...inputStates.values()].filter((s) => s.state === "correct").length;
  const allCorrect = submitted && correctCount === activeBlanks.length && activeBlanks.length > 0;
  const pri = card.priority ? PRIORITY_LABEL[card.priority] : null;
  const someInput = activeBlanks.some((t) => (inputs.get(t.idx) ?? "").trim() !== "");

  // 編集モードの凡例
  const editLegend = (
    <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 px-1">
      <span className="flex items-center gap-1">
        <span className="inline-block bg-indigo-100 text-indigo-800 border-b-2 border-indigo-400 rounded px-1.5">語句</span>
        既存の伏字（タップでOFF）
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block bg-gray-100 text-gray-400 line-through rounded px-1.5">語句</span>
        伏字OFF（タップでON）
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block bg-amber-100 text-amber-800 border-b-2 border-amber-400 rounded px-1.5">語句</span>
        カスタム追加（タップで解除）
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block hover:bg-gray-100 rounded px-1.5 text-gray-700">語句</span>
        通常テキスト（タップで追加）
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗バー */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-medium min-w-[60px]">{cardNumber} / {total}</span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(cardNumber / total) * 100}%` }} />
        </div>
      </div>

      {/* メタ情報 */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2.5 py-1 rounded-full">
          {card.subject}
        </span>
        {card.sectionHeader && (
          <span className="text-xs bg-gray-800 text-white font-semibold px-2.5 py-1 rounded-full">
            {card.sectionHeader}
          </span>
        )}
        {card.subsectionTitle && (
          <span className="text-xs bg-gray-700 text-gray-200 font-semibold px-2.5 py-1 rounded-full">
            {card.subsectionTitle}
          </span>
        )}
        {pri && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${pri.bg} ${pri.color}`}>
            {card.priority} ({pri.label})
          </span>
        )}
        <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full">p.{card.page}</span>
      </div>

      {/* ── 編集モード ── */}
      {editMode ? (
        <>
          {/* 編集コンテキスト */}
          <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-md p-5 text-[15px] leading-8 text-gray-700">
            <EditTokens
              tokens={tokens}
              blankedSet={blankedSet}
              disabledOriginals={disabledOriginals}
              customSet={customSet}
              onToggle={handleToggleToken}
            />
          </div>

          {/* 凡例 */}
          {editLegend}

          {/* 編集操作ボタン */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 text-sm transition-colors"
            >
              <RotateCcw size={15} />
              リセット
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-base hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
            >
              編集完了
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ── 学習モード ── */}
          {/* コンテキストカード */}
          <div className={`bg-white rounded-3xl border-2 shadow-md p-5 text-[15px] leading-8 text-gray-700 transition-colors ${
            !submitted ? "border-gray-100"
            : allCorrect ? "border-emerald-300"
            : "border-red-200"
          }`}>
            <StudyTokens
              tokens={tokens}
              blankedSet={blankedSet}
              disabledOriginals={disabledOriginals}
              inputStates={inputStates}
              blankNumberMap={blankNumberMap}
            />
          </div>

          {/* 入力フォーム or 結果 */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {activeBlanks.map((t, ai) => (
                <div key={t.idx} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0">
                    ({ai + 1})
                  </span>
                  <input
                    ref={(el) => { inputRefs.current.set(t.idx, el); }}
                    value={inputs.get(t.idx) ?? ""}
                    onChange={(e) => {
                      const next = new Map(inputs);
                      next.set(t.idx, e.target.value);
                      setInputs(next);
                    }}
                    placeholder={`空欄 (${ai + 1}) を入力...`}
                    className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                  />
                </div>
              ))}
              <div className="flex gap-2 mt-1">
                <button
                  type="submit"
                  disabled={!someInput}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-base transition-all shadow-md ${
                    someInput
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  採点する
                </button>
                <button type="button" onClick={handleReveal}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="答えを見る">
                  <Eye size={18} />
                </button>
                <button type="button" onClick={() => setEditMode(true)}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="伏字を編集">
                  <Pencil size={18} />
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {activeBlanks.map((t, ai) => {
                const s = inputStates.get(t.idx)?.state ?? "unanswered";
                return (
                  <div key={t.idx} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                    s === "correct"
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-red-50 border border-red-200"
                  }`}>
                    {s === "correct"
                      ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">空欄 ({ai + 1})</p>
                      {s === "correct"
                        ? <p className="font-semibold text-emerald-700 text-sm">正解！</p>
                        : <>
                            <p className="font-semibold text-red-600 text-sm">
                              正解：<span className="font-bold">{t.text}</span>
                            </p>
                            {(inputs.get(t.idx) ?? "") && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                あなたの回答：{inputs.get(t.idx)}
                              </p>
                            )}
                          </>
                      }
                    </div>
                  </div>
                );
              })}

              {activeBlanks.length > 1 && (
                <div className={`text-center text-sm font-bold rounded-2xl py-2 ${
                  allCorrect ? "text-emerald-600 bg-emerald-50" : "text-indigo-600 bg-indigo-50"
                }`}>
                  {correctCount} / {activeBlanks.length} 正解
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setEditMode(true)}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="伏字を編集">
                  <Pencil size={18} />
                </button>
                <button onClick={onNext}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-md">
                  次の問題へ
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
