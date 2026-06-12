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
import { renderRichText, makeFormatKeyHandler } from "../lib/richText";
import FormatToolbar from "./FormatToolbar";

interface Props {
  card: Card;
  cardNumber: number;
  total: number;
  subjectIndex: number;
  onResult: (results: boolean[]) => void;
  onNext: () => void;
  isFlagged?: boolean;
  onToggleFlag?: () => void;
}

const PRIORITY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  H: { label: "High",   color: "text-red-600",   bg: "bg-red-50 border-red-200"    },
  M: { label: "Middle", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  L: { label: "Low",    color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
};

function judge(input: string, answer: string): "exact" | "partial" | false {
  // 記号・句読点をすべてスペースに変換してから正規化（ハイフン・セミコロン等を無視）
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const u = norm(input), a = norm(answer);
  if (!u) return false;
  // 数字が含まれる場合：正解の数字がすべてユーザー入力に含まれていなければ不正解
  const answerNums = a.match(/\d+/g);
  if (answerNums && answerNums.length > 0) {
    const inputNums = u.match(/\d+/g) ?? [];
    const inputNumSet = new Set(inputNums);
    if (!answerNums.every(n => inputNumSet.has(n))) return false;
  }
  if (u === a) return "exact";
  // 語幹正規化: 複数形 / 三単現 などを統一（ies→y, 末尾s除去）
  const stem = (w: string) =>
    w.endsWith("ies") && w.length > 4 ? w.slice(0, -3) + "y" :
    w.endsWith("ing") && w.length > 5 ? w.slice(0, -3) :
    w.endsWith("s")   && w.length > 3 ? w.slice(0, -1) : w;
  const stemAll = (s: string) => s.split(/\s+/).map(stem).join(" ");
  const uStem = stemAll(u), aStem = stemAll(a);
  if (uStem === aStem) return "exact";
  const stop = new Set(["a","an","the","of","in","on","to","is","are","or","and","by","that","it","be","at","as","has","have","had","can","may","shall","will","its","their","which"]);
  // キーワード抽出（語幹ベース）
  const kws = aStem.split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
  const matches = kws.length === 0
    ? (aStem.includes(uStem) || uStem.includes(aStem))
    : kws.filter(kw => uStem.includes(kw) || u.includes(kw)).length >= Math.ceil(kws.length * 0.5);
  return matches ? "partial" : false;
}

function isListStartText(text: string): boolean {
  return /^(\d+[).]\s*|[a-z][).]\s*|[ivxlcdm]+[).]\s*|[−–•▪■○]|\*)/.test(text);
}

/** 箇条書きマーカーか判定 */
const BULLET_RE = /^[▪•■]$/;
/** ダッシュ系の箇条書きマーカーか判定（行頭限定） */
const DASH_BULLET_RE = /^[−–]$/;
/** サブ箇条書きマーカーか判定（○ = U+25CB） */
const SUB_BULLET_RE = /^[○]$/;

/** 行末から取り出した最後の "表示テキスト"（blank は answer 文字列）を使う */
function prevDisplayText(t: Token): string {
  return t.text;
}

/** prev→cur のセパレータ種別を返す */
function lineSep(prev: Token, cur: Token): "break" | "space" | "none" {
  const curText = cur.type === "word" ? cur.text : "";

  if (prev.lineIdx === cur.lineIdx) {
    // 句読点トークン（, . ; : など）の前にはスペースを入れない
    if (/^[,.:;]+$/.test(curText)) return "none";
    const standaloneListDash = DASH_BULLET_RE.test(curText);
    if (standaloneListDash) {
      const pt = prevDisplayText(prev);
      if (prev.type === "originalBlank" || pt.endsWith(".") || pt.endsWith(";")) {
        return "break";
      }
    }
    return "space";
  }

  // 行をまたぐ場合 → 常に改行（ハイフン連結のみ例外）
  if (prevDisplayText(prev).endsWith("-")) return "none"; // ハイフン連結
  return "break";
}

// Legacy wrapper for EditTokens which still uses ReactNode separator
function separator(prev: Token, cur: Token, key: string): React.ReactNode {
  const kind = lineSep(prev, cur);
  if (kind === "break") return <br key={key} />;
  if (kind === "space") return <span key={key}> </span>;
  return null;
}

// ---- Blank box renderers --------------------------------------------------

function BlankBox({ answer, num, state, onClick }: {
  answer: string;
  num: number;
  state: "unanswered" | "exact" | "partial" | "incorrect";
  onClick?: () => void;
}) {
  const em = Math.min(24, Math.max(4, Math.round(answer.length * 0.6)));
  const numLabel = (
    <span className="text-[10px] font-bold text-indigo-400 select-none mr-0.5 align-baseline">
      ({num})
    </span>
  );
  if (state === "unanswered") {
    return (
      <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5 max-w-full"
        onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
        {numLabel}
        <span className="inline-block bg-gray-200 text-gray-200 rounded px-1.5 select-none align-middle"
          style={{ minWidth: `${em}em`, maxWidth: "100%" }}>_</span>
      </span>
    );
  }
  if (state === "exact") {
    return (
      <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5 max-w-full">
        {numLabel}
        <span className="inline-block bg-emerald-100 text-emerald-800 font-semibold rounded px-1.5 align-middle break-words">
          {answer}
        </span>
      </span>
    );
  }
  if (state === "partial") {
    return (
      <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5 max-w-full">
        {numLabel}
        <span className="inline-block bg-teal-100 text-teal-800 font-semibold rounded px-1.5 align-middle break-words">
          {answer}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-0.5 align-baseline mx-0.5 max-w-full">
      {numLabel}
      <span className="inline-block bg-red-100 text-red-700 font-semibold rounded px-1.5 align-middle break-words">
        {answer}
      </span>
    </span>
  );
}

// ---- Study mode -----------------------------------------------------------

type InputState = "unanswered" | "exact" | "partial" | "incorrect";

function StudyTokens({
  tokens,
  activeBlanks,
  inputStates,
  blankNumberMap,
  onFocusBlank,
}: {
  tokens: Token[];
  activeBlanks: ActiveBlank[];
  inputStates: Map<string, InputState>; // blank.id or subBlank.id → state
  blankNumberMap: Map<string, number>;  // blank.id or subBlank.id → 1-based number
  onFocusBlank?: (blankId: string) => void;
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

  // 行ベース構造でレンダリング（箇条書きを適切に表示するため）
  type RenderLine = { isBullet: boolean; isSubBullet: boolean; nodes: React.ReactNode[] };
  const lines: RenderLine[] = [{ isBullet: false, isSubBullet: false, nodes: [] }];
  let prev: Token | null = null;

  function curLine() { return lines[lines.length - 1]; }
  function pushNode(n: React.ReactNode) { curLine().nodes.push(n); }

  for (const t of tokens) {
    if (skipSet.has(t.idx)) { prev = t; continue; }

    if (prev !== null) {
      const kind = lineSep(prev, t);
      if (kind === "break") {
        lines.push({ isBullet: false, isSubBullet: false, nodes: [] });
      } else if (kind === "space") {
        pushNode(<span key={`sep-${t.idx}`}> </span>);
      }
      // "none" → ハイフン連結、何も挿入しない
    }

    // 行頭の箇条書きマーカー → bullet フラグをセットしてスキップ（自前マーカーを表示）
    if (t.type === "word" && (BULLET_RE.test(t.text) || DASH_BULLET_RE.test(t.text)) && curLine().nodes.length === 0) {
      curLine().isBullet = true;
      prev = t;
      continue;
    }
    // 行頭のサブ箇条書きマーカー（○）→ isSubBullet フラグをセットしてスキップ
    if (t.type === "word" && SUB_BULLET_RE.test(t.text) && curLine().nodes.length === 0) {
      curLine().isSubBullet = true;
      prev = t;
      continue;
    }

    const entry = blankMap.get(t.idx);
    if (entry) {
      if (entry.blank.chunks) {
        // 有効チャンクごとに subBlanks が対応（なければ親 blank を使う）
        let enabledIdx = 0;
        entry.blank.chunks.forEach((chunk, ci) => {
          if (ci > 0) pushNode(<span key={`csp-${t.idx}-${ci}`}> </span>);
          if (chunk.type === "disabled") {
            pushNode(<span key={`cd-${t.idx}-${ci}`}>{chunk.text}</span>);
          } else {
            const sub = entry.blank.subBlanks?.[enabledIdx];
            const bId = sub ? sub.id : entry.blank.id;
            const bAnswer = sub ? sub.answer : entry.blank.answer;
            const bNum = blankNumberMap.get(bId) ?? entry.number;
            const state = inputStates.get(bId) ?? "unanswered";
            pushNode(
              <BlankBox key={`cb-${t.idx}-${ci}`} answer={bAnswer} num={bNum} state={state}
                onClick={() => onFocusBlank?.(bId)} />
            );
            enabledIdx++;
          }
        });
      } else {
        const state = inputStates.get(entry.blank.id) ?? "unanswered";
        pushNode(<BlankBox key={t.idx} answer={entry.blank.answer} num={entry.number} state={state} />);
      }
    } else if (disabledOrigSet.has(t.idx)) {
      pushNode(<span key={t.idx}>{t.text}</span>);
    } else {
      pushNode(<span key={t.idx}>{t.text}</span>);
    }

    prev = t;
  }

  return (
    <div>
      {lines.map((line, li) =>
        line.isSubBullet ? (
          <div key={li} className="flex items-baseline gap-2 pl-6 mt-0.5">
            <span className="text-gray-400 flex-shrink-0 leading-8 text-[11px]">○</span>
            <span className="flex-1 min-w-0">{line.nodes}</span>
          </div>
        ) : line.isBullet ? (
          <div key={li} className="flex items-baseline gap-2 pl-1 mt-0.5">
            <span className="text-gray-400 flex-shrink-0 leading-8 text-[13px]">▪</span>
            <span className="flex-1 min-w-0">{line.nodes}</span>
          </div>
        ) : (
          <span key={li} className={li > 0 ? "block" : undefined}>{line.nodes}</span>
        )
      )}
    </div>
  );
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

export default function FlashCard({ card, cardNumber, total, subjectIndex, onResult, onNext, isFlagged = false, onToggleFlag }: Props) {
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

  // blank.id / subBlank.id → 1-based番号
  const blankNumberMap = useMemo(() => {
    const m = new Map<string, number>();
    let n = 1;
    for (const b of activeBlanks) {
      if (b.subBlanks && b.subBlanks.length > 1) {
        for (const sb of b.subBlanks) m.set(sb.id, n++);
      } else {
        m.set(b.id, n++);
      }
    }
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

    // 選択トークンをトークン順に並べ、間に非選択トークンが挟まる場合は
    // 別グループに分割する（例: A B [gap:C] D E → [A,B] と [D,E] の2グループ）
    const sortedTokens = tokens.filter(t => pendingSelection.has(t.idx));
    const groups: number[][] = [];
    let current: number[] = [];

    for (let i = 0; i < sortedTokens.length; i++) {
      if (i === 0) {
        current.push(sortedTokens[i].idx);
        continue;
      }
      const prevIdx = sortedTokens[i - 1].idx;
      const curIdx = sortedTokens[i].idx;
      // prevIdx と curIdx の間に非選択トークン（word/originalBlank 問わず）があるか確認
      const hasGap = tokens
        .slice(prevIdx + 1, curIdx)
        .some(t => !pendingSelection.has(t.idx));
      if (hasGap) {
        if (current.length > 0) groups.push(current);
        current = [curIdx];
      } else {
        current.push(curIdx);
      }
    }
    if (current.length > 0) groups.push(current);

    const next = { ...override };
    // 新しい選択範囲と重なる既存グループを除去（古い状態との干渉を防ぐ）
    next.customBlanks = next.customBlanks.filter(
      g => !g.some(idx => pendingSelection.has(idx))
    );
    next.customBlanks = [...next.customBlanks, ...groups];
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
      if (b.subBlanks && b.subBlanks.length > 1) {
        for (const sb of b.subBlanks) {
          const input = inputs.get(sb.id) ?? "";
          const result = judge(input, sb.answer);
          newStates.set(sb.id, result || "incorrect");
          results.push(!!result);
        }
      } else {
        const input = inputs.get(b.id) ?? "";
        const result = judge(input, b.answer);
        newStates.set(b.id, result || "incorrect");
        results.push(!!result);
      }
    }
    setInputStates(newStates);
    setSubmitted(true);
    onResult(results);
  }

  function handleReveal() {
    if (submitted) return;
    const newStates = new Map<string, InputState>();
    for (const b of activeBlanks) {
      if (b.subBlanks && b.subBlanks.length > 1) {
        for (const sb of b.subBlanks) newStates.set(sb.id, "incorrect");
      } else {
        newStates.set(b.id, "incorrect");
      }
    }
    setInputStates(newStates);
    setSubmitted(true);
    onResult(activeBlanks.flatMap(b => b.subBlanks && b.subBlanks.length > 1 ? b.subBlanks.map(() => false) : [false]));
  }

  // 全入力 ID（subBlanks 考慮）
  const allInputIds = useMemo(() =>
    activeBlanks.flatMap(b =>
      b.subBlanks && b.subBlanks.length > 1 ? b.subBlanks.map(sb => ({ id: sb.id, answer: sb.answer })) : [{ id: b.id, answer: b.answer }]
    ), [activeBlanks]);

  const exactCount = [...inputStates.values()].filter(s => s === "exact").length;
  const partialCount = [...inputStates.values()].filter(s => s === "partial").length;
  const correctCount = exactCount + partialCount;
  const allCorrect = submitted && allInputIds.length > 0 && correctCount === allInputIds.length;
  const pri = card.priority ? PRIORITY_LABEL[card.priority] : null;
  const someInput = allInputIds.some(({ id }) => (inputs.get(id) ?? "").trim() !== "");

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
      <div className="flex gap-2 flex-wrap items-center">
        {onToggleFlag && (
          <button
            type="button"
            onClick={onToggleFlag}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
              isFlagged
                ? "bg-amber-50 text-amber-500 border-amber-300 hover:bg-amber-100"
                : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-amber-50 hover:text-amber-400 hover:border-amber-200"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={isFlagged ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            {isFlagged ? "フラグ済み" : "フラグ"}
          </button>
        )}
        <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-2.5 py-1 rounded-full">
          {card.subject} <span className="opacity-60">#{subjectIndex}</span>
        </span>
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
          <div className={`bg-white rounded-3xl border-2 shadow-md p-5 text-[15px] leading-8 text-gray-700 transition-colors overflow-hidden ${
            !submitted ? "border-gray-100" : allCorrect ? "border-emerald-300" : "border-red-200"
          }`}>
            <StudyTokens tokens={tokens} activeBlanks={activeBlanks} inputStates={inputStates}
              blankNumberMap={blankNumberMap}
              onFocusBlank={(id) => inputRefs.current.get(id)?.focus()} />
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {activeBlanks.map((b) => {
                // subBlanks がある場合は各チャンクごとに入力欄を表示
                const rows = b.subBlanks && b.subBlanks.length > 1
                  ? b.subBlanks.map(sb => ({ id: sb.id, answer: sb.answer }))
                  : [{ id: b.id, answer: b.answer }];
                return rows.map(({ id }) => {
                  const num = blankNumberMap.get(id) ?? 0;
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0">({num})</span>
                      <input
                        ref={(el) => { inputRefs.current.set(id, el); }}
                        value={inputs.get(id) ?? ""}
                        onChange={(e) => {
                          const next = new Map(inputs);
                          next.set(id, e.target.value);
                          setInputs(next);
                        }}
                        placeholder={`空欄 (${num}) を入力...`}
                        className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-400 bg-white"
                      />
                    </div>
                  );
                });
              })}
              <div className="flex gap-2 mt-1">
                <button type="submit" disabled={!someInput}
                  className={`flex-1 py-3.5 rounded-2xl font-bold text-base transition-all shadow-md ${
                    someInput
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}>採点する</button>
                <button type="button" onClick={onNext}
                  className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-base hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1"
                  title="スキップして次へ">次へ <ChevronRight size={16} /></button>
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
                const rows = b.subBlanks && b.subBlanks.length > 1
                  ? b.subBlanks.map(sb => ({ id: sb.id, answer: sb.answer }))
                  : [{ id: b.id, answer: b.answer }];
                return rows.map(({ id, answer }) => {
                  const num = blankNumberMap.get(id) ?? 0;
                  const s = inputStates.get(id) ?? "unanswered";
                  return (
                    <div key={id} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                      s === "exact" ? "bg-emerald-50 border border-emerald-200"
                      : s === "partial" ? "bg-teal-50 border border-teal-200"
                      : "bg-red-50 border border-red-200"
                    }`}>
                      {s === "exact"
                        ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        : s === "partial"
                        ? <CheckCircle size={18} className="text-teal-400 flex-shrink-0 mt-0.5" />
                        : <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">空欄 ({num})</p>
                        {s === "exact"
                          ? <>
                              <p className="font-semibold text-emerald-700 text-sm">正解！</p>
                              {(inputs.get(id) ?? "") && (
                                <p className="text-xs text-emerald-600 mt-0.5">あなたの回答：{inputs.get(id)}</p>
                              )}
                            </>
                          : s === "partial"
                          ? <>
                              <p className="font-semibold text-teal-700 text-sm">ほぼ正解 <span className="text-[11px] font-normal text-teal-600">（部分一致）</span></p>
                              <p className="text-xs text-teal-700 mt-0.5">正解：<span className="font-bold">{answer}</span></p>
                              {(inputs.get(id) ?? "") && (
                                <p className="text-xs text-teal-600 mt-0.5">あなたの回答：{inputs.get(id)}</p>
                              )}
                            </>
                          : <>
                              <p className="font-semibold text-red-600 text-sm">
                                正解：<span className="font-bold">{answer}</span>
                              </p>
                              {(inputs.get(id) ?? "") && (
                                <p className="text-xs text-gray-400 mt-0.5">あなたの回答：{inputs.get(id)}</p>
                              )}
                            </>
                        }
                      </div>
                    </div>
                  );
                });
              })}

              {allInputIds.length > 1 && (
                <div className={`text-center text-sm font-bold rounded-2xl py-2 ${
                  allCorrect ? "text-emerald-600 bg-emerald-50" : "text-indigo-600 bg-indigo-50"
                }`}>{correctCount} / {allInputIds.length} 正解</div>
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
                      onKeyDown={makeFormatKeyHandler(memoToolbarRef, setMemoInput)}
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
