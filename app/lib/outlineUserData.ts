"use client";

const STORAGE_KEY = "outline_user_data";

interface CardData {
  flag: boolean;
  memo: string;
  highlights: string[]; // e.g. "b:0", "t:2" (prefix:lineIndex)
}

type Store = Record<string, CardData>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function key(subject: string, id: number) {
  return `${subject}__${id}`;
}

export function getCardData(subject: string, id: number): CardData {
  const store = load();
  return store[key(subject, id)] ?? { flag: false, memo: "", highlights: [] };
}

export function setFlag(subject: string, id: number, flag: boolean) {
  const store = load();
  const k = key(subject, id);
  const prev = store[k] ?? { memo: "", highlights: [] };
  store[k] = { ...prev, flag };
  save(store);
}

export function setMemo(subject: string, id: number, memo: string) {
  const store = load();
  const k = key(subject, id);
  const prev = store[k] ?? { flag: false, highlights: [] };
  store[k] = { ...prev, memo };
  save(store);
}

export function toggleHighlight(subject: string, id: number, lineKey: string) {
  const store = load();
  const k = key(subject, id);
  const prev = store[k] ?? { flag: false, memo: "", highlights: [] };
  const hl = new Set(prev.highlights ?? []);
  if (hl.has(lineKey)) hl.delete(lineKey);
  else hl.add(lineKey);
  store[k] = { ...prev, highlights: Array.from(hl) };
  save(store);
  return hl;
}
