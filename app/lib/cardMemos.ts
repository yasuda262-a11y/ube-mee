/**
 * カードごとのメモ — localStorage 永続化
 */

const STORAGE_KEY = "ube-card-memos";

type CardMemoStore = Record<number, string>; // cardId → memo text

function load(): CardMemoStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(store: CardMemoStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getCardMemo(cardId: number): string {
  return load()[cardId] ?? "";
}

export function saveCardMemo(cardId: number, text: string) {
  const store = load();
  const trimmed = text.trim();
  if (trimmed) {
    store[cardId] = trimmed;
  } else {
    delete store[cardId];
  }
  save(store);
  // Supabase に非同期保存
  if (typeof window !== "undefined") {
    import("./db").then(({ saveCardMemoRemote }) => {
      saveCardMemoRemote(cardId, trimmed).catch(() => {});
    });
  }
}
