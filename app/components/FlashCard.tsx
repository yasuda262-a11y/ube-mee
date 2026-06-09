"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, CheckCircle, XCircle, Eye } from "lucide-react";
import type { Card } from "../data/questions";

interface Props {
  card: Card;
  cardNumber: number;
  total: number;
  onResult: (results: boolean[]) => void;  // blanks分の正誤配列
  onNext: () => void;
}

const PRIORITY_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  H: { label: "High", color: "text-red-600", bg: "bg-red-50 border-red-200" },
  M: { label: "Middle", color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  L: { label: "Low", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
};

/** キーワード一致（ゆるめ）判定 */
function judge(input: string, answer: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const userN = norm(input);
  const ansN = norm(answer);
  if (!userN) return false;
  if (userN === ansN) return true;
  const stopWords = new Set(["a","an","the","of","in","on","to","is","are","or","and","by","that","it","be","at","as"]);
  const keywords = ansN.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  if (keywords.length === 0) return ansN.includes(userN) || userN.includes(ansN);
  const matched = keywords.filter((kw) => userN.includes(kw));
  return matched.length >= Math.ceil(keywords.length * 0.6);
}

/** context文字列の1行分を __BLANK_N__ でパースしてReact要素の配列に変換 */
function parseContextLine(
  line: string,
  states: ("unanswered" | "correct" | "incorrect")[],
  answers: string[],
  keyOffset: number
): React.ReactNode[] {
  const parts = line.split(/(__BLANK_\d+__)/g);
  return parts.map((part, i) => {
    const m = part.match(/^__BLANK_(\d+)__$/);
    if (!m) return <span key={keyOffset + i}>{part}</span>;
    const idx = parseInt(m[1]) - 1;  // 0-based
    const state = states[idx] ?? "unanswered";
    const answer = answers[idx] ?? "";
    if (state === "unanswered") {
      return (
        <span key={keyOffset + i} className="inline-block bg-gray-200 text-gray-200 rounded px-1.5 select-none min-w-[60px] mx-0.5">
          {"____"}
        </span>
      );
    }
    if (state === "correct") {
      return (
        <span key={keyOffset + i} className="inline-block bg-emerald-100 text-emerald-800 font-semibold rounded px-1.5 mx-0.5">
          {answer}
        </span>
      );
    }
    return (
      <span key={keyOffset + i} className="inline-block bg-red-100 text-red-700 font-semibold rounded px-1.5 mx-0.5">
        {answer}
      </span>
    );
  });
}

/** 行がリスト項目（番号・箇条書き記号）で始まるか判定 */
function isListStart(line: string): boolean {
  // 先頭の __BLANK_N__ を除去してからチェック
  const stripped = line.trimStart().replace(/^(__BLANK_\d+__\s*)+/, "");
  // 番号リスト: "1) ", "2. ", "i) ", "ii. ", "a) "
  // 箇条書き: "− ", "– ", "• "
  return /^(\d+[).]\s|[a-z][).]\s|[ivxlcdm]+[).]\s|[−–•]\s|[−–]$)/.test(stripped);
}

/** context文字列を改行・__BLANK_N__ でパースしてReact要素の配列に変換 */
function parseContext(
  context: string,
  blanksCount: number,
  states: ("unanswered" | "correct" | "incorrect")[],
  answers: string[]
): React.ReactNode[] {
  const lines = context.split("\n");
  const result: React.ReactNode[] = [];
  let keyOffset = 0;
  lines.forEach((line, li) => {
    if (li > 0) {
      const prevLine = lines[li - 1];
      // 前の行の末尾単語を取得（__BLANK_N__ を除く）
      const prevWords = prevLine.trim().split(/\s+/);
      const prevLast = [...prevWords].reverse().find(w => !w.startsWith("__BLANK_")) ?? "";
      const prevEndsHyphen = prevLast.endsWith("-");

      if (prevEndsHyphen) {
        // ハイフン連結: "non-" + "resident:" → "non-resident:" (セパレータなし)
      } else if (isListStart(line)) {
        // リスト項目: 改行
        result.push(<br key={`br-${li}`} />);
      } else {
        // 通常の折り返し: スペースで結合
        result.push(<span key={`sp-${li}`}> </span>);
      }
    }
    result.push(...parseContextLine(line, states, answers, keyOffset));
    keyOffset += line.split(/(__BLANK_\d+__)/).length;
  });
  return result;
}

export default function FlashCard({ card, cardNumber, total, onResult, onNext }: Props) {
  const blanksCount = card.blanks.length;
  const [inputs, setInputs] = useState<string[]>(Array(blanksCount).fill(""));
  const [states, setStates] = useState<("unanswered" | "correct" | "incorrect")[]>(
    Array(blanksCount).fill("unanswered")
  );
  const [submitted, setSubmitted] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setInputs(Array(card.blanks.length).fill(""));
    setStates(Array(card.blanks.length).fill("unanswered"));
    setSubmitted(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  }, [card.id, card.blanks.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted) return;
    const newStates = card.blanks.map((b, i) =>
      judge(inputs[i] ?? "", b.answer) ? "correct" : "incorrect"
    ) as ("correct" | "incorrect")[];
    setStates(newStates);
    setSubmitted(true);
    onResult(newStates.map((s) => s === "correct"));
  }

  function handleReveal() {
    if (submitted) return;
    const newStates = Array(blanksCount).fill("incorrect") as "incorrect"[];
    setStates(newStates);
    setSubmitted(true);
    onResult(newStates.map(() => false));
  }

  const allCorrect = submitted && states.every((s) => s === "correct");
  const correctCount = states.filter((s) => s === "correct").length;
  const pri = card.priority ? PRIORITY_LABEL[card.priority] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗バー */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-medium min-w-[60px]">{cardNumber} / {total}</span>
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(cardNumber / total) * 100}%` }}
          />
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

      {/* 文脈カード */}
      <div className={`bg-white rounded-3xl border-2 shadow-md p-5 text-[15px] leading-8 text-gray-700 transition-colors ${
        !submitted ? "border-gray-100"
        : allCorrect ? "border-emerald-300"
        : "border-red-200"
      }`}>
        {parseContext(card.context, blanksCount, states, card.blanks.map((b) => b.answer))}
      </div>

      {/* 入力欄群 */}
      {!submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {card.blanks.map((blank, i) => (
            <div key={blank.idx} className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400 w-5 flex-shrink-0">({blank.idx})</span>
              <input
                ref={(el) => { inputRefs.current[i] = el; }}
                value={inputs[i] ?? ""}
                onChange={(e) => {
                  const next = [...inputs];
                  next[i] = e.target.value;
                  setInputs(next);
                }}
                placeholder={`空欄 (${blank.idx}) を入力...`}
                className="flex-1 px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-900 text-sm focus:outline-none focus:border-indigo-400 bg-white"
              />
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={inputs.every((v) => !v.trim())}
              className={`flex-1 py-3.5 rounded-2xl font-bold text-base transition-all shadow-md ${
                inputs.some((v) => v.trim())
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              採点する
            </button>
            <button
              type="button"
              onClick={handleReveal}
              className="px-4 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
              title="答えを見る"
            >
              <Eye size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 各blank結果 */}
          {card.blanks.map((blank, i) => {
            const s = states[i];
            return (
              <div key={blank.idx} className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${
                s === "correct" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
              }`}>
                {s === "correct"
                  ? <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <XCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-0.5">空欄 ({blank.idx})</p>
                  {s === "correct"
                    ? <p className="font-semibold text-emerald-700 text-sm">正解！</p>
                    : <>
                        <p className="font-semibold text-red-600 text-sm">
                          正解：<span className="font-bold">{blank.answer}</span>
                        </p>
                        {inputs[i] && (
                          <p className="text-xs text-gray-400 mt-0.5">あなたの回答：{inputs[i]}</p>
                        )}
                      </>
                  }
                </div>
              </div>
            );
          })}

          {/* スコア表示 */}
          {blanksCount > 1 && (
            <div className={`text-center text-sm font-bold rounded-2xl py-2 ${
              allCorrect ? "text-emerald-600 bg-emerald-50" : "text-indigo-600 bg-indigo-50"
            }`}>
              {correctCount} / {blanksCount} 正解
            </div>
          )}

          <button
            onClick={onNext}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
          >
            次の問題へ
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
