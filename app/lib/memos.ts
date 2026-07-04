/**
 * 英語表現メモ — localStorage + Supabase 永続化
 */

import { supabase } from "./supabase";

export type Memo = {
  id: number;
  word: string;      // 主題となる単語（アルファベット順インデックス）
  content: string;   // メモ本文（説明・注意事項など）
  examples: string;  // 例文
  tags: string[];    // 任意タグ（例: "collocation", "usage", "grammar"）
  createdAt: string; // ISO date string
};

const STORAGE_KEY = "ube-expression-memos";

function load(): Memo[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(memos: Memo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

async function getUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Supabaseに1件upsert（fire-and-forget）
async function upsertToSupabase(memo: Memo) {
  const uid = await getUserId();
  if (!uid) return;
  await supabase.from("expression_memos").upsert(
    {
      user_id: uid,
      memo_id: memo.id,
      word: memo.word,
      content: memo.content,
      examples: memo.examples,
      tags: memo.tags,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,memo_id" }
  );
}

// Supabaseから1件削除（fire-and-forget）
async function deleteFromSupabase(id: number) {
  const uid = await getUserId();
  if (!uid) return;
  await supabase.from("expression_memos")
    .delete()
    .eq("user_id", uid)
    .eq("memo_id", id);
}

// SupabaseからフェッチしてlocalStorageとマージ（起動時1回）
export async function syncMemosFromSupabase() {
  const uid = await getUserId();
  if (!uid) return;
  const { data, error } = await supabase
    .from("expression_memos")
    .select("memo_id, word, content, examples, tags, created_at")
    .eq("user_id", uid);
  if (error || !data) return;

  const local = load();
  const localIds = new Set(local.map((m) => m.id));
  const remote: Memo[] = data.map((r) => ({
    id: r.memo_id,
    word: r.word,
    content: r.content,
    examples: r.examples,
    tags: r.tags ?? [],
    createdAt: r.created_at,
  }));
  // localにないものをSupabaseから追加
  const toAdd = remote.filter((r) => !localIds.has(r.id));
  if (toAdd.length > 0) {
    save([...local, ...toAdd]);
  }
}

/** アルファベット順（word）で並べて返す。word が空の場合は末尾 */
export function getMemos(): Memo[] {
  return load().sort((a, b) => {
    const aw = (a.word ?? "").toLowerCase();
    const bw = (b.word ?? "").toLowerCase();
    if (!aw && !bw) return b.id - a.id;
    if (!aw) return 1;
    if (!bw) return -1;
    return aw < bw ? -1 : aw > bw ? 1 : 0;
  });
}

export function addMemo(word: string, content: string, examples: string, tags: string[]): Memo {
  const memos = load();
  const id = Date.now();
  const memo: Memo = {
    id,
    word: word.trim(),
    content: content.trim(),
    examples: examples.trim(),
    tags,
    createdAt: new Date().toISOString(),
  };
  save([...memos, memo]);
  upsertToSupabase(memo).catch(() => {});
  return memo;
}

export function updateMemo(id: number, word: string, content: string, examples: string, tags: string[]) {
  const memos = load().map((m) =>
    m.id === id ? { ...m, word: word.trim(), content: content.trim(), examples: examples.trim(), tags } : m
  );
  save(memos);
  const updated = memos.find((m) => m.id === id);
  if (updated) upsertToSupabase(updated).catch(() => {});
}

export function deleteMemo(id: number) {
  save(load().filter((m) => m.id !== id));
  deleteFromSupabase(id).catch(() => {});
}

export function getAllTags(memos: Memo[]): string[] {
  const set = new Set<string>();
  for (const m of memos) m.tags.forEach((t) => set.add(t));
  return Array.from(set).sort();
}
