"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, CheckCircle, XCircle, Eye } from "lucide-react";
import type { Question } from "../data/questions";

interface Props {
  question: Question;
  cardNumber: number;
  total: number;
  onResult: (correct: boolean) => void;
  onNext: () => void;
}

/** キーワード一致（ゆるめ）判定 */
function judge(input: string, answer: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const userN = norm(input);
  const ansN = norm(answer);
  if (!userN) return false;
  if (userN === ansN) return true;

  // 正解の各単語のうち「中身のある単語」（stop word除外）が入力に含まれるか
  const stopWords = new Set(["a", "an", "the", "of", "in", "on", "to", "is", "are", "or", "and", "by", "that", "it"]);
  const keywords = ansN.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
  if (keywords.length === 0) return ansN.includes(userN) || userN.includes(ansN);
  const matched = keywords.filter((kw) => userN.includes(kw));
  return matched.length >= Math.ceil(keywords.length * 0.6);
}

/** context 中の __BLANK__ をハイライト表示に変換 */
function renderContext(context: string, state: "unanswered" | "correct" | "incorrect", answer: string) {
  const parts = context.split("__BLANK__");
  const blankEl = state === "unanswered"
    ? <span key="blank" className="inline-block bg-gray-200 text-gray-200 rounded px-1 select-none min-w-[60px]">{"____"}</span>
    : state === "correct"
    ? <span key="blank" className="inline-block bg-emerald-100 text-emerald-800 font-semibold rounded px-1">{answer}</span>
    : <span key="blank" className="inline-block bg-red-100 text-red-700 font-semibold rounded px-1">{answer}</span>;

  return parts.flatMap((part, i) =>
    i < parts.length - 1 ? [part, blankEl] : [part]
  );
}

export default function FlashCard({ question, cardNumber, total, onResult, onNext }: Props) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<"unanswered" | "correct" | "incorrect">("unanswered");
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput("");
    setState("unanswered");
    setRevealed(false);
    setResultRecorded(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [question.id]);

  const [resultRecorded, setResultRecorded] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state !== "unanswered") return;
    const correct = judge(input, question.answer);
    setState(correct ? "correct" : "incorrect");
    if (!resultRecorded) { onResult(correct); setResultRecorded(true); }
  }

  function handleReveal() {
    setRevealed(true);
    setState("incorrect");
    if (!resultRecorded) { onResult(false); setResultRecorded(true); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 進捗バー */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-medium min-w-[60px]">
          {cardNumber} / {total}
        </span>
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
          {question.subject}
        </span>
        <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
          p.{question.page}
        </span>
      </div>

      {/* 文脈カード */}
      <div className={`bg-white rounded-3xl border-2 shadow-md p-5 text-[15px] leading-7 text-gray-700 transition-colors ${
        state === "correct" ? "border-emerald-300" :
        state === "incorrect" ? "border-red-300" : "border-gray-100"
      }`}>
        {renderContext(question.context, state, question.answer)}
      </div>

      {/* 入力 or 結果 */}
      {state === "unanswered" ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="空欄に入る語句を入力..."
            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 text-gray-900 text-base focus:outline-none focus:border-indigo-400 bg-white"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!input.trim()}
              className={`flex-1 py-3.5 rounded-2xl font-bold text-base transition-all shadow-md ${
                input.trim()
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
          {/* 判定結果 */}
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
            state === "correct" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
          }`}>
            {state === "correct"
              ? <CheckCircle size={20} className="text-emerald-500 flex-shrink-0" />
              : <XCircle size={20} className="text-red-400 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              {state === "correct"
                ? <p className="font-semibold text-emerald-700">正解！</p>
                : <>
                    <p className="font-semibold text-red-600">不正解</p>
                    <p className="text-sm text-red-500 mt-0.5">
                      正解：<span className="font-bold">{question.answer}</span>
                    </p>
                    {input && <p className="text-xs text-gray-400 mt-0.5">あなたの回答：{input}</p>}
                  </>
              }
            </div>
          </div>

          {/* 次へ */}
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
