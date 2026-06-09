"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Pencil, Check, X, Tag, ChevronRight } from "lucide-react";
import { getMemos, addMemo, updateMemo, deleteMemo, getAllTags, type Memo } from "../lib/memos";

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
  initial?: { content: string; tags: string[] };
  onSave: (content: string, tags: string[]) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  return (
    <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-4 flex flex-col gap-3">
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="英語表現メモを入力…&#10;例）assent は reach / establish と相性が良い"
        rows={4}
        className="w-full text-sm text-gray-800 leading-relaxed resize-none outline-none placeholder:text-gray-400"
      />
      <div>
        <p className="text-[11px] text-gray-400 mb-1 flex items-center gap-1">
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
          onClick={() => content.trim() && onSave(content, tags)}
          disabled={!content.trim()}
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
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{memo.content}</p>
      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {memo.tags.map((t) => (
            <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagColor(t)}`}>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-[11px] text-gray-400">{date}</span>
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-gray-400 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={onDelete}
                className="text-[11px] text-white bg-red-500 rounded-lg px-2 py-1 hover:bg-red-400 active:scale-95 transition-all"
              >
                削除確認
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={13} />
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
            <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap text-center">
              {current.content}
            </p>
            {current.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-center">
                {current.tags.map((t) => (
                  <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${tagColor(t)}`}>{t}</span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 flex items-center gap-2">
            タップして表示 <ChevronRight size={16} />
          </p>
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

// ---- メインコンポーネント ---------------------------------------------------
export default function MemoList({ onBack }: { onBack: () => void }) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  function reload() { setMemos(getMemos()); }
  useEffect(() => { reload(); }, []);

  const allTags = getAllTags(memos);
  const filtered = filterTag ? memos.filter((m) => m.tags.includes(filterTag)) : memos;

  if (reviewMode) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
        <ReviewMode memos={filtered} onExit={() => setReviewMode(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
          onSave={(content, tags) => {
            addMemo(content, tags);
            reload();
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

      {/* メモ一覧 */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-12">
          {filterTag ? `「${filterTag}」のメモはありません` : "メモはまだありません"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((memo) =>
            editingId === memo.id ? (
              <MemoForm
                key={memo.id}
                initial={{ content: memo.content, tags: memo.tags }}
                onSave={(content, tags) => {
                  updateMemo(memo.id, content, tags);
                  reload();
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <MemoCard
                key={memo.id}
                memo={memo}
                onEdit={() => setEditingId(memo.id)}
                onDelete={() => { deleteMemo(memo.id); reload(); }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
