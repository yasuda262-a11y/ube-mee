"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronRight, CheckCircle, XCircle, Eye, Pencil, RotateCcw, Plus, NotebookPen, Check, X } from "lucide-react";
import type { Card } from "../data/questions";
import {
  parseTokens,
  getOverride,
  saveOverride,
  resetOverride,
  getActiveBlanks,
  buildBlankMap,
  buildSkipSet,
  splitBlankIntoChunks,
  type Token,
  type BlankOverride,
  type ActiveBlank,
} from "../lib/customBlanks";
import { getCardMemo, saveCardMemo } from "../lib/cardMemos";
import { renderRichText } from "../lib/richText";
import FormatToolbar from "./FormatToolbar";

interface Props {
  card: Card;
  cardNumber: number;
  total: number;
  onResult: (results: boolean[]) => void;
  onNext: () => void;
}

const PRIORITY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  H: { label: "High",   color: "text-red-600",   bg: "bg-red-50 border-red-200"    },
  M: { label: "Middle", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  L: { label: "Low",    color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
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

/** 行末から取り出した最後の "表示テキスト"（blank は answer 文字列）を使う */
function prevDisplayText(t: Token): string {
  return t.text;
}

function separator(prev: Token, cur: Token, key: string): React.ReactNode {
  const curText = cur.type === "word" ? cur.text : "";

  if (prev.lineIdx === cur.lineIdx) {
    // 同一行でも "−" / "–" の直前でブランクか文末ピリオドがある場合は改行
    // （PDF上は別行だが抽出時に同一行にまとめられたケース）
    const standaloneListDash = /^[−–]$/.test(curText);
    if (standaloneListDash) {
      const pt = prevDisplayText(prev);
      if (prev.type === "originalBlank" || pt.endsWith(".") || pt.endsWith(";")) {
        return <br key={key} />;
      }
    }
    return <span key={key}> </span>;
  }

  // 行をまたぐ場合
  if (prevDisplayText(prev).endsWith("-")) return null; // ハイフン連結
  if (isListStartText(curText)) return <br key={key} />;
  return <span key={key}> </span>;
}

// ---- Blank box renderers --------------------------------------------------

function BlankBox({ answer, num, state }: {
  answer: string;
  num: number;
  state: "unanswered" | "correct" | "incorrect";
}) {
  const em = Math.min(24, Math.max(4, Math.round(answer.length * 0.6)));
  const numLabel = (
    <span className="text-[10px] font-bold text-indigo-400 select-none mr-0.5 align-baseline">
      ({num})
    </span>
  );
  if (state === "unanswered") {
    return (
      <span className="inline-block align-baseline mx-0.5 whitespace-nowrap">
        {numLabel}
        <span className="inline-block bg-gray-200 text-gray-200 rounded px-1.5 select-none align-middle"
          style={{ minWidth: `${em}em` }}>_</span>
      </span>
    );
  }
  if (state === "correct") {
    return (
      <span className="inline-block align-baseline mx-0.5 whitespace-nowrap">
        {numLabel}
        <span className="inline-block bg-emerald-100 text-emerald-800 font-semibold rounded px-1.5 align-middle">
          {answer}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-block align-baseline mx-0.5 whitespace-nowrap">
      {numLabel}
      <span className="inline-block bg-red-100 text-red-700 font-semibold rounded px-1.5 align-middle">
        {answer}
      </span>
    </span>
  );
}

// ---- Study mode -----------------------------------------------------------

type InputState = "unanswered" | "correct" | "incorrect";

function StudyTokens({
  tokens,
  activeBlanks,
  inputStates,
}: {
  tokens: Token[];
  activeBlanks: ActiveBlank[];
  inputStates: Map<string, InputState>; // blank.id → state
}) {
  const blankMap = useMemo(() => buildBlankMap(activeBlanks), [activeBlanks]);
  const skipSet = useMemo(() => buildSkipSet(activeBlanks), [activeBlanks]);
  const disabledOrigSet = useMemo(() => {
    const s = new Set<number>();
    // token is disabled-original if it's an originalBlank not in blankMap
    for (const t of tokens) {
      if (t.type === "originalBlank" && !blankMap.has(t.idx)) s.add(t.idx);
    }
    return s;
  }, [tokens, blankMap]);

  const nodes: React.ReactNode[] = [];
  let prev: Token | null = null;

  for (const t of tokens) {
    if (skipSet.has(t.idx)) { prev = t; continue; }

    if (prev !== null) {
      const sep = separator(prev, t, `sep-${t.idx}`);
      if (sep) nodes.push(sep);
    }

    const entry = blankMap.get(t.idx);
    if (entry) {
      const state = inputStates.get(entry.blank.id) ?? "unanswered";
      if (entry.blank.chunks) {
        // 部分的に無効化されている originalBlank:
        // チャンクを元の順序通りにレンダリングする。
        // disabled → グレーイタリック（元の位置に留まる）
        // enabled 1つ目 → BlankBox（全 enabled 単語を answer に含む）
        // enabled 2つ目以降 → 下線プレースホルダー（同じ空欄の続きを示す）
        let blankRendered = false;
        entry.blank.chunks.forEach((chunk, ci) => {
          if (ci > 0) nodes.push(<span key={`csp-${t.idx}-${ci}`}> </span>);
          if (chunk.type === "disabled") {
            nodes.push(<span key={`cd-${t.idx}-${ci}`} className="text-gray-400 italic">{chunk.text}</span>);
          } else if (!blankRendered) {
            blankRendered = true;
            nodes.push(<BlankBox key={`cb-${t.idx}-${ci}`} answer={entry.blank.answer} num={entry.number} state={state} />);
          } else {
            // 2つ目以降の enabled チャンク: 下線スパンで位置を示す（同じ空欄の続き）
            const dashLen = Math.max(chunk.text.length, 3);
            nodes.push(
              <span
                key={`ce-${t.idx}-${ci}`}
                className="inline-block border-b-2 border-indigo-400 min-w-[1.5rem] mx-0.5"
                style={{ color: "transparent", userSelect: "none" }}
              >{"_".repeat(dashLen)}</span>
            );
          }
        });
      } else {
        nodes.push(
          <BlankBox key={t.idx} answer={entry.blank.answer} num={entry.number} state={state} />
        );
      }
    } else if (disabledOrigSet.has(t.idx)) {
      nodes.push(<span key={t.idx} className="text-gray-400 italic">{t.text}</span>);
    } else {
      nodes.push(<span key={t.idx}>{t.text}</span>);
    }

    prev = t;
  }

  return <>{nodes}</>;
}

// ---- Edit mode ------------------------------------------------------------

function EditTokens({
  tokens,
  override,
  pendingSelection,
  onToggleOriginalWord,
  onWordTap,
}: {
  tokens: Token[];
  override: BlankOverride;
  pendingSelection: Set<number>;
  onToggleOriginalWord: (blankIdx: number, wordIdx: number) => void;
  onWordTap: (t: Token) => void;
}) {
  const disabledOrigSet = new Set(override.disabledOriginalBlanks);
  const customTokenSet = new Set(override.customBlanks.flat());
  // token.idx → group index
  const tokenToGroup = new Map<number, number>();
  override.customBlanks.forEach((g, gi) => g.forEach((idx) => tokenToGroup.set(idx, gi)));

  const nodes: React.ReactNode[] = [];
  let prev: Token | null = null;

  for (const t of tokens) {
    if (prev !== null) {
      const sep = separator(prev, t, `sep-${t.idx}`);
      if (sep) nodes.push(sep);
    }

    if (t.type === "originalBlank") {
      // 伏字が丸ごと OFF なら打ち消しチップとして1つ表示
      if (disabledOrigSet.has(t.blankIdx!)) {
        nodes.push(
          <button key={t.idx} type="button"
            onClick={() => {
              const next = { ...override };
              next.disabledOriginalBlanks = next.disabledOriginalBlanks.filter(b => b !== t.blankIdx);
              saveOverride(-1, next); // handled in parent via callback
              onWordTap({ ...t, type: "originalBlank" }); // reuse tap handler
            }}
            title="クリックして伏字に戻す"
            className="inline-block bg-gray-100 text-gray-400 line-through rounded px-1 py-0.5 text-[14px] leading-7 cursor-pointer">
            {t.text}
          </button>
        );
      } else {
        // 単語レベルで展開して表示
        const words = t.text.split(" ");
        const disabledSubWords = new Set(override.partialDisabledWords[t.blankIdx!] ?? []);
        words.forEach((word, wi) => {
          if (wi > 0) nodes.push(<span key={`ws-${t.idx}-${wi}`}> </span>);
          const isDisabled = disabledSubWords.has(wi);
          nodes.push(
            <button key={`w-${t.idx}-${wi}`} type="button"
              onClick={() => onToggleOriginalWord(t.blankIdx!, wi)}
              title={isDisabled ? "クリックして伏字に戻す" : "クリックして伏字から除外"}
              className={`inline rounded px-1 py-0.5 text-[14px] leading-7 font-medium transition-colors cursor-pointer ${
                isDisabled
                  ? "bg-gray-100 text-gray-400 line-through"
                  : "bg-indigo-100 text-indigo-800 border-b-2 border-indigo-400"
              }`}>
              {word}
            </button>
          );
        });
      }
    } else {
      // word token
      const inCustom = customTokenSet.has(t.idx);
      const inPending = pendingSelection.has(t.idx);

      nodes.push(
        <button key={t.idx} type="button"
          onClick={() => onWordTap(t)}
          title={
            inCustom ? "クリックして伏字を解除" :
            inPending ? "クリックして選択を解除" :
            "クリックして選択（複数選択して伏字に追加可）"
          }
          className={`inline rounded px-1 py-0.5 text-[14px] leading-7 transition-colors cursor-pointer ${
            inCustom
              ? "bg-amber-100 text-amber-800 border-b-2 border-amber-400 font-medium"
              : inPending
              ? "bg-yellow-100 text-yellow-800 border-2 border-yellow-400 font-medium"
              : "hover:bg-gray-100 text-gray-700"
          }`}>
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
    partialDisabledWords: {},
    customBlanks: [],
  });
  const [inputs, setInputs] = useState<Map<string, string>>(new Map()); // blank.id → input
  const [inputStates, setInputStates] = useState<Map<string, InputState>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<Set<number>>(new Set());
  const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // ---- カードメモ ----
  const [cardMemo, setCardMemo] = useState("");
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const memoRef = useRef<HTMLTextAreaElement>(null);
  // FormatToolbar に渡す ref（型を合わせる）
  const memoToolbarRef = memoRef as React.RefObject<HTMLTextAreaElement | null>;

  const tokens = useMemo(() => parseTokens(card.context, card.blanks), [card.id]);

  const activeBlanks = useMemo(
    () => getActiveBlanks(tokens, override),
    [tokens, override]
  );

  // blank.id → 1-based番号
  const blankNumberMap = useMemo(() => {
    const m = new Map<string, number>();
    activeBlanks.forEach((b, i) => m.set(b.id, i + 1));
    return m;
  }, [activeBlanks]);

  useEffect(() => {
    const ov = getOverride(card.id);
    setOverride(ov);
    setInputs(new Map());
    setInputStates(new Map());
    setSubmitted(false);
    setEditMode(false);
    setPendingSelection(new Set());
    // カードメモを読み込む
    const memo = getCardMemo(card.id);
    setCardMemo(memo);
    setMemoInput(memo);
    setMemoEditing(false);
    setTimeout(() => {
      const first = inputRefs.current.values().next().value;
      first?.focus();
    }, 50);
  }, [card.id]);

  function applyOverride(next: BlankOverride) {
    setOverride(next);
    saveOverride(card.id, next);
  }

  function openMemoEdit() {
    setMemoInput(cardMemo);
    setMemoEditing(true);
    setTimeout(() => memoRef.current?.focus(), 50);
  }
  function saveMemo() {
    saveCardMemo(card.id, memoInput);
    setCardMemo(memoInput.trim());
    setMemoEditing(false);
  }
  function cancelMemo() {
    setMemoInput(cardMemo);
    setMemoEditing(false);
  }

  // originalBlank の単語レベル toggle
  function handleToggleOriginalWord(blankIdx: number, wordIdx: number) {
    const next = { ...override };
    const prev = new Set(next.partialDisabledWords[blankIdx] ?? []);
    prev.has(wordIdx) ? prev.delete(wordIdx) : prev.add(wordIdx);

    const words = card.blanks[blankIdx]?.answer?.split(" ") ?? [];
    if (prev.size === words.length) {
      // 全単語無効 → 丸ごと無効扱いに統一
      next.disabledOriginalBlanks = [...new Set([...next.disabledOriginalBlanks, blankIdx])];
      const pd = { ...next.partialDisabledWords };
      delete pd[blankIdx];
      next.partialDisabledWords = pd;
    } else {
      next.partialDisabledWords = { ...next.partialDisabledWords, [blankIdx]: [...prev] };
      next.disabledOriginalBlanks = next.disabledOriginalBlanks.filter(b => b !== blankIdx);
    }
    applyOverride(next);
  }

  // word token tap in edit mode
  function handleWordTap(t: Token) {
    if (t.type === "originalBlank") {
      // 丸ごと OFF → ON に戻す
      const next = { ...override };
      next.disabledOriginalBlanks = next.disabledOriginalBlanks.filter(b => b !== t.blankIdx);
      applyOverride(next);
      return;
    }

    // カスタムグループに既に属している → グループから除去
    const groupIdx = override.customBlanks.findIndex(g => g.includes(t.idx));
    if (groupIdx >= 0) {
      const next = { ...override };
      const group = next.customBlanks[groupIdx].filter(idx => idx !== t.idx);
      if (group.length === 0) {
        next.customBlanks = next.customBlanks.filter((_, i) => i !== groupIdx);
      } else {
        next.customBlanks = next.customBlanks.map((g, i) => i === groupIdx ? group : g);
      }
      applyOverride(next);
      return;
    }

    // pending selection に toggle
    const next = new Set(pendingSelection);
    next.has(t.idx) ? next.delete(t.idx) : next.add(t.idx);
    setPendingSelection(next);
  }

  // pending selection を確定してカスタムグループに追加
  function handleConfirmSelection() {
    if (pendingSelection.size === 0) return;
    const next = { ...override };
    next.customBlanks = [...next.customBlanks, [...pendingSelection]];
    applyOverride(next);
    setPendingSelection(new Set());
  }

  function handleCancelSelection() {
    setPendingSelection(new Set());
  }

  function handleReset() {
    resetOverride(card.id);
    setOverride({ disabledOriginalBlanks: [], partialDisabledWords: {}, customBlanks: [] });
    setPendingSelection(new Set());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    const newStates = new Map<string, InputState>();
    const results: boolean[] = [];
    for (const b of activeBlanks) {
      const input = inputs.get(b.id) ?? "";
      const correct = judge(input, b.answer);
      newStates.set(b.id, correct ? "correct" : "incorrect");
      results.push(correct);
    }
    setInputStates(newStates);
    setSubmitted(true);
    onResult(results);
  }

  function handleReveal() {
    if (submitted) return;
    const newStates = new Map<string, InputState>();
    for (const b of activeBlanks) newStates.set(b.id, "incorrect");
    setInputStates(newStates);
    setSubmitted(true);
    onResult(activeBlanks.map(() => false));
  }

  const correctCount = [...inputStates.values()].filter(s => s === "correct").length;
  const allCorrect = submitted && activeBlanks.length > 0 && correctCount === activeBlanks.length;
  const pri = card.priority ? PRIORITY_LABEL[card.priority] : null;
  const someInput = activeBlanks.some(b => (inputs.get(b.id) ?? "").trim() !== "");

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
        <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2.5 py-1 rounded-full">{card.subject}</span>
        {card.sectionHeader && (
          <span className="text-xs bg-gray-800 text-white font-semibold px-2.5 py-1 rounded-full">{card.sectionHeader}</span>
        )}
        {card.subsectionTitle && (
          <span className="text-xs bg-gray-700 text-gray-200 font-semibold px-2.5 py-1 rounded-full">{card.subsectionTitle}</span>
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
          <div className="bg-white rounded-3xl border-2 border-indigo-200 shadow-md p-5 text-[15px] leading-8 text-gray-700">
            <EditTokens
              tokens={tokens}
              override={override}
              pendingSelection={pendingSelection}
              onToggleOriginalWord={handleToggleOriginalWord}
              onWordTap={handleWordTap}
            />
          </div>

          {/* pending selection の確定バー */}
          {pendingSelection.size > 0 && (
            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-2xl px-4 py-3">
              <span className="flex-1 text-sm text-yellow-800 font-medium">
                {pendingSelection.size}語を選択中
              </span>
              <button type="button" onClick={handleCancelSelection}
                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-xl border border-gray-200">
                キャンセル
              </button>
              <button type="button" onClick={handleConfirmSelection}
                className="flex items-center gap-1 text-xs font-bold bg-amber-500 text-white px-3 py-1.5 rounded-xl hover:bg-amber-600">
                <Plus size={13} />
                伏字に追加
              </button>
            </div>
          )}

          {/* 凡例 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-500 px-1">
            <span className="flex items-center gap-1">
              <span className="bg-indigo-100 text-indigo-800 border-b-2 border-indigo-400 rounded px-1.5">語句</span>既存の伏字（タップで単語単位に解除）
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-gray-100 text-gray-400 line-through rounded px-1.5">語句</span>伏字OFF（タップでON）
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-amber-100 text-amber-800 border-b-2 border-amber-400 rounded px-1.5">語句</span>カスタム追加（タップで解除）
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-yellow-100 text-yellow-800 border-2 border-yellow-400 rounded px-1.5">語句</span>選択中（複数選択→「伏字に追加」）
            </span>
            <span className="flex items-center gap-1">
              <span className="hover:bg-gray-100 rounded px-1.5 text-gray-700">語句</span>通常テキスト（タップで選択）
            </span>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 text-sm transition-colors">
              <RotateCcw size={15} />リセット
            </button>
            <button type="button" onClick={() => setEditMode(false)}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-base hover:bg-indigo-700 active:scale-95 transition-all shadow-md">
              編集完了
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ── 学習モード ── */}
          <div className={`bg-white rounded-3xl border-2 shadow-md p-5 text-[15px] leading-8 text-gray-700 transition-colors ${
            !submitted ? "border-gray-100" : allCorrect ? "border-emerald-300" : "border-red-200"
          }`}>
            <StudyTokens tokens={tokens} activeBlanks={activeBlanks} inputStates={inputStates} />
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {activeBlanks.map((b) => {
                const num = blankNumberMap.get(b.id) ?? 0;
                return (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0">({num})</span>
                    <input
                      ref={(el) => { inputRefs.current.set(b.id, el); }}
                      value={inputs.get(b.id) ?? ""}
                      onChange={(e) => {
                        const next = new Map(inputs);
                        next.set(b.id, e.target.value);
                        setInputs(next);
                      }}
                      placeholder={`空欄 (${num}) を入力...`}
                      className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 mt-1">
                <button type="submit" disabled={!someInput}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-base transition-all shadow-md ${
                    someInput
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}>採点する</button>
                <button type="button" onClick={handleReveal}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="答えを見る"><Eye size={18} /></button>
                <button type="button" onClick={() => setEditMode(true)}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="伏字を編集"><Pencil size={18} /></button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {activeBlanks.map((b) => {
                const num = blankNumberMap.get(b.id) ?? 0;
                const s = inputStates.get(b.id) ?? "unanswered";
                return (
                  <div key={b.id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                    s === "correct" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                  }`}>
                    {s === "correct"
                      ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">空欄 ({num})</p>
                      {s === "correct"
                        ? <p className="font-semibold text-emerald-700 text-sm">正解！</p>
                        : <>
                            <p className="font-semibold text-red-600 text-sm">
                              正解：<span className="font-bold">{b.answer}</span>
                            </p>
                            {(inputs.get(b.id) ?? "") && (
                              <p className="text-xs text-gray-400 mt-0.5">あなたの回答：{inputs.get(b.id)}</p>
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
                }`}>{correctCount} / {activeBlanks.length} 正解</div>
              )}

              {/* カードメモ */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-amber-100">
                  <span className="text-[11px] font-semibold text-amber-600 flex items-center gap-1">
                    <NotebookPen size={11} /> カードメモ
                  </span>
                  {memoEditing ? (
                    <FormatToolbar textareaRef={memoToolbarRef} onChange={setMemoInput} theme="amber" />
                  ) : (
                    <button
                      onClick={openMemoEdit}
                      className="text-[11px] text-amber-500 hover:text-amber-700 flex items-center gap-0.5 transition-colors"
                    >
                      <Pencil size={11} /> {cardMemo ? "編集" : "追加"}
                    </button>
                  )}
                </div>

                {memoEditing ? (
                  <div className="p-3 flex flex-col gap-2">
                    <textarea
                      ref={memoRef}
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      placeholder="このカードへのメモを入力…"
                      rows={3}
                      className="w-full text-sm text-gray-800 leading-relaxed resize-none outline-none bg-transparent placeholder:text-amber-300"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={cancelMemo}
                        className="flex items-center gap-1 text-xs text-gray-400 border border-gray-200 bg-white rounded-xl px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition-all"
                      >
                        <X size={11} /> キャンセル
                      </button>
                      <button
                        onClick={saveMemo}
                        className="flex items-center gap-1 text-xs text-white bg-amber-500 rounded-xl px-3 py-1.5 hover:bg-amber-400 active:scale-95 transition-all"
                      >
                        <Check size={11} /> 保存
                      </button>
                    </div>
                  </div>
                ) : cardMemo ? (
                  <p
                    onClick={openMemoEdit}
                    className="px-3 py-2.5 text-sm text-gray-700 leading-relaxed cursor-text"
                  >
                    {renderRichText(cardMemo)}
                  </p>
                ) : (
                  <p
                    onClick={openMemoEdit}
                    className="px-3 py-2.5 text-xs text-amber-300 italic cursor-text"
                  >
                    タップしてメモを追加…
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setEditMode(true)}
                  className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                  title="伏字を編集"><Pencil size={18} /></button>
                <button onClick={onNext}
                  className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-md">
                  次の問題へ <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
