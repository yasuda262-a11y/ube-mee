"use client";

import { supabase } from "./supabase";

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

// Fire-and-forget Supabase upsert
async function syncToSupabase(store: Store) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("outline_user_data").upsert(
      { user_id: user.id, data: store, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch {}
}

// Fetch from Supabase and merge into localStorage (Supabase wins on highlights union)
export async function syncFromSupabase() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("outline_user_data")
      .select("data")
      .eq("user_id", user.id)
      .single();
    if (!data?.data) return;

    const remote = data.data as Store;
    const local = load();
    const merged: Store = { ...remote };
    for (const [k, v] of Object.entries(local)) {
      if (!merged[k]) {
        merged[k] = v;
      } else {
        merged[k] = {
          flag: v.flag || merged[k].flag,
          memo: v.memo || merged[k].memo,
          highlights: Array.from(new Set([...(merged[k].highlights ?? []), ...(v.highlights ?? [])])),
        };
      }
    }
    save(merged);
  } catch {}
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
  syncToSupabase(store);
}

export function setMemo(subject: string, id: number, memo: string) {
  const store = load();
  const k = key(subject, id);
  const prev = store[k] ?? { flag: false, highlights: [] };
  store[k] = { ...prev, memo };
  save(store);
  syncToSupabase(store);
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
  syncToSupabase(store);
  return hl;
}
