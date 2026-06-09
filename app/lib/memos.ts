/**
 * 英語表現メモ — localStorage 永続化
 */

export type Memo = {
  id: number;
  content: string;   // メモ本文
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

export function getMemos(): Memo[] {
  return load().sort((a, b) => b.id - a.id); // 新しい順
}

export function addMemo(content: string, tags: string[]): Memo {
  const memos = load();
  const id = Date.now();
  const memo: Memo = { id, content: content.trim(), tags, createdAt: new Date().toISOString() };
  save([...memos, memo]);
  return memo;
}

export function updateMemo(id: number, content: string, tags: string[]) {
  const memos = load().map((m) =>
    m.id === id ? { ...m, content: content.trim(), tags } : m
  );
  save(memos);
}

export function deleteMemo(id: number) {
  save(load().filter((m) => m.id !== id));
}

export function getAllTags(memos: Memo[]): string[] {
  const set = new Set<string>();
  for (const m of memos) m.tags.forEach((t) => set.add(t));
  return Array.from(set).sort();
}
