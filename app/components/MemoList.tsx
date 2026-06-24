"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, Pencil, Check, X, Tag, ChevronRight, BookText, Quote, Search } from "lucide-react";
import { addMemo, updateMemo, deleteMemo, getAllTags, type Memo } from "../lib/memos";
import { fetchExpressionMemos, saveExpressionMemosRemote } from "../lib/db";
import { renderRichText, makeFormatKeyHandler } from "../lib/richText";
import FormatToolbar from "./FormatToolbar";

// ---- タグピル ----------------------------------------------------------------
const TAG_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];
function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

// ---- タグ入力 ----------------------------------------------------------------
function TagInput({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function commit() {
    const v = input.trim().toLowerCase();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-[2rem] p-1.5 border border-gray-200 rounded-xl bg-gray-50">
      {tags.map((t) => (
        <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${tagColor(t)}`}>
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:opacity-60">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && !input && tags.length > 0)
            onChange(tags.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={tags.length === 0 ? "タグ追加（Enterで確定）" : ""}
        className="flex-1 min-w-[8rem] bg-transparent text-xs outline-none placeholder:text-gray-400 px-1"
      />
    </div>
  );
}

// ---- 編集フォーム ------------------------------------------------------------
function MemoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { word: string; content: string; examples: string; tags: string[] };
  onSave: (word: string, content: string, examples: string, tags: string[]) => void;
  onCancel: () => void;
}) {
  const [word, setWord] = useState(initial?.word ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [examples, setExamples] = useState(initial?.examples ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const wordRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const examplesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { wordRef.current?.focus(); }, []);

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-4 flex flex-col gap-4">
      {/* 主題単語 */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 font-semibold tracking-wide uppercase">単語（インデックス）</p>
        <input
          ref={wordRef}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="例）assent"
          className="w-full text-base font-bold text-gray-800 border-b-2 border-gray-200 pb-1.5 outline-none placeholder:text-gray-300 focus:border-indigo-400 transition-colors"
        />
      </div>

      {/* メモ本文 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] text-gray-400 font-semibold tracking-wide uppercase flex items-center gap-1">
            <BookText size={10} /> メモ
          </p>
          <FormatToolbar textareaRef={contentRef} onChange={setContent} theme="indigo" />
        </div>
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={makeFormatKeyHandler(contentRef, setContent)}
          placeholder="説明・注意事項など&#10;例）reach / establish などの動詞と相性が良い"
          rows={3}
          className="w-full text-sm text-gray-800 leading-relaxed resize-none outline-none placeholder:text-gray-400"
        />
      </div>

      {/* 例文 */}
      <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] text-amber-600 font-semibold tracking-wide uppercase flex items-center gap-1">
            <Quote size={10} /> 例文
          </p>
          <FormatToolbar textareaRef={examplesRef} onChange={setExamples} theme="amber" />
        </div>
        <textarea
          ref={examplesRef}
          value={examples}
          onChange={(e) => setExamples(e.target.value)}
          onKeyDown={makeFormatKeyHandler(examplesRef, setExamples)}
          placeholder="例）Mutual assent is established when both parties..."
          rows={3}
          className="w-full text-sm text-gray-700 leading-relaxed resize-none outline-none placeholder:text-gray-400 bg-transparent italic"
        />
      </div>

      {/* タグ */}
      <div>
        <p className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1">
          <Tag size={10} /> タグ（任意）
        </p>
        <TagInput tags={tags} onChange={setTags} />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition-all"
        >
          <X size={13} /> キャンセル
        </button>
        <button
          type="button"
          onClick={() => (word.trim() || content.trim()) && onSave(word, content, examples, tags)}
          disabled={!word.trim() && !content.trim()}
          className="flex items-center gap-1 text-xs text-white bg-indigo-600 rounded-xl px-3 py-1.5 hover:bg-indigo-500 disabled:opacity-40 active:scale-95 transition-all"
        >
          <Check size={13} /> 保存
        </button>
      </div>
    </div>
  );
}

// ---- メモカード --------------------------------------------------------------
function MemoCard({
  memo,
  onEdit,
  onDelete,
}: {
  memo: Memo;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const date = new Date(memo.createdAt).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      {/* 単語タイトル */}
      {memo.word && (
        <p className="text-base font-bold text-gray-900 tracking-wide">{memo.word}</p>
      )}
      {/* メモ本文 */}
      {memo.content && (
        <p className="text-sm text-gray-700 leading-relaxed">{renderRichText(memo.content)}</p>
      )}
      {/* 例文 */}
      {memo.examples && (
        <div className="bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
          <p className="text-[10px] text-amber-500 font-semibold mb-0.5 uppercase tracking-wide flex items-center gap-1">
            <Quote size={9} /> 例文
          </p>
          <p className="text-sm text-gray-700 leading-relaxed italic">{renderRichText(memo.examples)}</p>
        </div>
      )}
      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {memo.tags.map((t) => (
            <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagColor(t)}`}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">{date}</span>
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-1.5 hover:bg-gray-50 active:scale-95 transition-all"
              >
                取消
              </button>
              <button
                onClick={onDelete}
                className="text-xs text-white bg-red-500 rounded-xl px-3 py-1.5 hover:bg-red-400 active:scale-95 transition-all"
              >
                削除確認
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5 hover:bg-indigo-100 active:scale-95 transition-all"
              >
                <Pencil size={12} /> 編集
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-1.5 hover:bg-red-100 active:scale-95 transition-all"
              >
                <Trash2 size={12} /> 削除
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- 復習モード（1枚ずつ表示）-------------------------------------------
function ReviewMode({ memos, onExit }: { memos: Memo[]; onExit: () => void }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  if (memos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <p className="text-sm">メモがありません</p>
        <button onClick={onExit} className="text-indigo-600 text-sm font-semibold">← 戻る</button>
      </div>
    );
  }

  const memo = memos[idx];
  const total = memos.length;

  // ランダムシャッフルは初回のみ
  const [shuffled] = useState(() => [...memos].sort(() => Math.random() - 0.5));
  const current = shuffled[idx];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="text-indigo-600 text-sm font-semibold">← 一覧</button>
        <span className="text-xs text-gray-400">{idx + 1} / {total}</span>
        <div className="w-16" />
      </div>

      {/* プログレスバー */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-400 rounded-full transition-all"
          style={{ width: `${((idx + 1) / total) * 100}%` }}
        />
      </div>

      {/* カード */}
      <div
        className="bg-white rounded-3xl border border-gray-100 shadow-md p-6 min-h-[12rem] flex flex-col items-center justify-center gap-4 cursor-pointer select-none active:scale-[0.98] transition-transform"
        onClick={() => setRevealed(true)}
      >
        {revealed ? (
          <>
            {current.word && (
              <p className="text-xl font-bold text-gray-900 text-center">{current.word}</p>
            )}
            {current.content && (
              <p className="text-sm text-gray-700 leading-relaxed text-center">
                {renderRichText(current.content)}
              </p>
            )}
            {current.examples && (
              <div className="w-full bg-amber-50 rounded-xl px-3 py-2 border border-amber-100">
                <p className="text-[10px] text-amber-500 font-semibold mb-0.5 uppercase tracking-wide flex items-center justify-center gap-1">
                  <Quote size={9} /> 例文
                </p>
                <p className="text-sm text-gray-700 leading-relaxed italic text-center">
                  {renderRichText(current.examples)}
                </p>
              </div>
            )}
            {current.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center">
                {current.tags.map((t) => (
                  <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagColor(t)}`}>{t}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {current.word && (
              <p className="text-xl font-bold text-gray-800">{current.word}</p>
            )}
            <p className="text-sm text-gray-400 flex items-center gap-2">
              タップして内容を表示 <ChevronRight size={16} />
            </p>
          </>
        )}
      </div>

      {/* ナビボタン */}
      <div className="flex gap-3">
        <button
          onClick={() => { setIdx((i) => Math.max(0, i - 1)); setRevealed(false); }}
          disabled={idx === 0}
          className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50 active:scale-95 transition-all"
        >
          ← 前へ
        </button>
        {idx + 1 < total ? (
          <button
            onClick={() => { setIdx((i) => i + 1); setRevealed(false); }}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 active:scale-95 transition-all"
          >
            次へ →
          </button>
        ) : (
          <button
            onClick={onExit}
            className="flex-1 py-3 rounded-2xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 active:scale-95 transition-all"
          >
            完了 ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ---- アルファベットインデックスバー -----------------------------------------
function AlphaBar({
  letters,
  onJump,
}: {
  letters: string[];
  onJump: (letter: string) => void;
}) {
  if (letters.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {letters.map((l) => (
        <button
          key={l}
          onClick={() => onJump(l)}
          className="w-7 h-7 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white active:scale-90 transition-all"
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ---- メインコンポーネント ---------------------------------------------------
export default function MemoList({ onBack }: { onBack: () => void }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [query, setQuery] = useState("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function reload() {
    const latest = await fetchExpressionMemos();
    setMemos([...latest].sort((a, b) => {
      const aw = (a.word ?? "").toLowerCase();
      const bw = (b.word ?? "").toLowerCase();
      if (!aw && !bw) return b.id - a.id;
      if (!aw) return 1;
      if (!bw) return -1;
      return aw < bw ? -1 : aw > bw ? 1 : 0;
    }));
  }
  useEffect(() => { reload(); }, []);

  // 検索 + タグフィルター
  const filtered = memos.filter((m) => {
    if (filterTag && !m.tags.includes(filterTag)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (m.word ?? "").toLowerCase().includes(q) ||
      m.content.toLowerCase().includes(q) ||
      (m.examples ?? "").toLowerCase().includes(q)
    );
  });

  // 頭文字でグルーピング
  type Group = { letter: string; memos: Memo[] };
  const groups: Group[] = [];
  for (const memo of filtered) {
    const letter = (memo.word?.[0] ?? "#").toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) {
      last.memos.push(memo);
    } else {
      groups.push({ letter, memos: [memo] });
    }
  }
  const activeLetters = groups.map((g) => g.letter);

  const jumpTo = useCallback((letter: string) => {
    sectionRefs.current[letter]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const allTags = getAllTags(memos);

  if (reviewMode) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
        <ReviewMode memos={filtered} onExit={() => setReviewMode(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 検索バー */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="単語・メモ・例文を検索…"
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:border-indigo-400 transition-colors placeholder:text-gray-400"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* アルファベットタブ */}
      {!query && <AlphaBar letters={activeLetters} onJump={jumpTo} />}

      {/* タグフィルター */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterTag(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !filterTag ? "bg-indigo-600 text-white border-transparent" : "text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            すべて
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setFilterTag(filterTag === t ? null : t)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterTag === t ? "bg-indigo-600 text-white border-transparent" : `${tagColor(t)} border-transparent`
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 追加フォーム */}
      {adding ? (
        <MemoForm
          onSave={async (word, content, examples, tags) => {
            addMemo(word, content, examples, tags);
            const updated = await fetchExpressionMemos();
            await saveExpressionMemosRemote(updated);
            await reload();
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 p-3.5 rounded-2xl border-2 border-dashed border-indigo-200 text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 active:scale-[0.98] transition-all"
        >
          <Plus size={16} />
          <span className="text-sm">新しいメモを追加</span>
        </button>
      )}

      {/* 復習ボタン */}
      {filtered.length > 0 && (
        <button
          onClick={() => setReviewMode(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 active:scale-[0.98] transition-all border border-indigo-100"
        >
          <ChevronRight size={15} />
          復習モード（{filtered.length}件をランダム表示）
        </button>
      )}

      {/* メモ一覧（頭文字セクション区切り） */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-12">
          {query ? `「${query}」に一致するメモはありません` : filterTag ? `「${filterTag}」のメモはありません` : "メモはまだありません"}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ letter, memos: gMemos }) => (
            <div
              key={letter}
              ref={(el) => { sectionRefs.current[letter] = el; }}
            >
              {/* 頭文字ヘッダー */}
              <div className="flex items-center gap-2 mb-3 scroll-mt-20">
                <span className="text-lg font-black text-indigo-600 w-7 leading-none">{letter}</span>
                <div className="flex-1 h-px bg-indigo-100" />
              </div>
              <div className="flex flex-col gap-3">
                {gMemos.map((memo) =>
                  editingId === memo.id ? (
                    <MemoForm
                      key={memo.id}
                      initial={{ word: memo.word ?? "", content: memo.content, examples: memo.examples ?? "", tags: memo.tags }}
                      onSave={async (word, content, examples, tags) => {
                        updateMemo(memo.id, word, content, examples, tags);
                        const updated = await fetchExpressionMemos();
                        await saveExpressionMemosRemote(updated);
                        await reload();
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <MemoCard
                      key={memo.id}
                      memo={memo}
                      onEdit={() => setEditingId(memo.id)}
                      onDelete={async () => {
                        deleteMemo(memo.id);
                        const updated = await fetchExpressionMemos();
                        await saveExpressionMemosRemote(updated);
                        await reload();
                      }}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
