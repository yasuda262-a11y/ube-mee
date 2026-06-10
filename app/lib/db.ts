"use client";
/**
 * Supabase-backed persistence layer.
 * Falls back to localStorage when not authenticated or offline.
 */
import { supabase } from "./supabase";
import type { BlankOverride } from "./customBlanks";
import type { StatsRecord } from "./stats";
import type { Memo } from "./memos";

// ---- helpers ----------------------------------------------------------------

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---- Blank Overrides --------------------------------------------------------

const OVERRIDE_LS = "ube-blank-overrides-v3";

export async function fetchOverrides(): Promise<Record<number, BlankOverride>> {
  const uid = await getUserId();
  if (!uid) {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_LS) ?? "{}"); } catch { return {}; }
  }
  const { data, error } = await supabase
    .from("blank_overrides")
    .select("card_id, override")
    .eq("user_id", uid);
  if (error) {
    try { return JSON.parse(localStorage.getItem(OVERRIDE_LS) ?? "{}"); } catch { return {}; }
  }
  const result: Record<number, BlankOverride> = {};
  for (const row of data ?? []) result[row.card_id] = row.override;
  // mirror to localStorage as cache
  localStorage.setItem(OVERRIDE_LS, JSON.stringify(result));
  return result;
}

export async function saveOverrideRemote(cardId: number, override: BlankOverride): Promise<void> {
  // always save to localStorage first (immediate)
  try {
    const store = JSON.parse(localStorage.getItem(OVERRIDE_LS) ?? "{}");
    store[cardId] = override;
    localStorage.setItem(OVERRIDE_LS, JSON.stringify(store));
  } catch { /* ignore */ }

  const uid = await getUserId();
  if (!uid) return;
  await supabase.from("blank_overrides").upsert(
    { user_id: uid, card_id: cardId, override, updated_at: new Date().toISOString() },
    { onConflict: "user_id,card_id" }
  );
}

// ---- Stats ------------------------------------------------------------------

const STATS_LS = "ube_stats";

export async function fetchStats(): Promise<StatsRecord> {
  const uid = await getUserId();
  if (!uid) {
    try { return JSON.parse(localStorage.getItem(STATS_LS) ?? "{}"); } catch { return {}; }
  }
  const { data, error } = await supabase
    .from("stats")
    .select("card_id, correct, total")
    .eq("user_id", uid);
  if (error) {
    try { return JSON.parse(localStorage.getItem(STATS_LS) ?? "{}"); } catch { return {}; }
  }
  const result: StatsRecord = {};
  for (const row of data ?? []) result[row.card_id] = { correct: row.correct, total: row.total };
  localStorage.setItem(STATS_LS, JSON.stringify(result));
  return result;
}

export async function saveStatRemote(cardId: number, correct: number, total: number): Promise<void> {
  try {
    const store: StatsRecord = JSON.parse(localStorage.getItem(STATS_LS) ?? "{}");
    store[cardId] = { correct, total };
    localStorage.setItem(STATS_LS, JSON.stringify(store));
  } catch { /* ignore */ }

  const uid = await getUserId();
  if (!uid) return;
  await supabase.from("stats").upsert(
    { user_id: uid, card_id: cardId, correct, total, updated_at: new Date().toISOString() },
    { onConflict: "user_id,card_id" }
  );
}

// ---- Card Memos -------------------------------------------------------------

const CARD_MEMO_LS = "ube-card-memos";

export async function fetchCardMemos(): Promise<Record<number, string>> {
  const uid = await getUserId();
  if (!uid) {
    try { return JSON.parse(localStorage.getItem(CARD_MEMO_LS) ?? "{}"); } catch { return {}; }
  }
  const { data, error } = await supabase
    .from("card_memos")
    .select("card_id, memo")
    .eq("user_id", uid);
  if (error) {
    try { return JSON.parse(localStorage.getItem(CARD_MEMO_LS) ?? "{}"); } catch { return {}; }
  }
  const result: Record<number, string> = {};
  for (const row of data ?? []) result[row.card_id] = row.memo;
  localStorage.setItem(CARD_MEMO_LS, JSON.stringify(result));
  return result;
}

export async function saveCardMemoRemote(cardId: number, memo: string): Promise<void> {
  try {
    const store: Record<number, string> = JSON.parse(localStorage.getItem(CARD_MEMO_LS) ?? "{}");
    store[cardId] = memo;
    localStorage.setItem(CARD_MEMO_LS, JSON.stringify(store));
  } catch { /* ignore */ }

  const uid = await getUserId();
  if (!uid) return;
  await supabase.from("card_memos").upsert(
    { user_id: uid, card_id: cardId, memo, updated_at: new Date().toISOString() },
    { onConflict: "user_id,card_id" }
  );
}

// ---- Expression Memos -------------------------------------------------------

const EXPR_MEMO_LS = "ube-expression-memos";

export async function fetchExpressionMemos(): Promise<Memo[]> {
  const uid = await getUserId();
  if (!uid) {
    try { return JSON.parse(localStorage.getItem(EXPR_MEMO_LS) ?? "[]"); } catch { return []; }
  }
  const { data, error } = await supabase
    .from("expression_memos")
    .select("memo_id, word, content, examples, tags, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });
  if (error) {
    try { return JSON.parse(localStorage.getItem(EXPR_MEMO_LS) ?? "[]"); } catch { return []; }
  }
  const result: Memo[] = (data ?? []).map(r => ({
    id: r.memo_id,
    word: r.word,
    content: r.content,
    examples: r.examples,
    tags: r.tags ?? [],
    createdAt: r.created_at,
  }));
  localStorage.setItem(EXPR_MEMO_LS, JSON.stringify(result));
  return result;
}

export async function saveExpressionMemosRemote(memos: Memo[]): Promise<void> {
  localStorage.setItem(EXPR_MEMO_LS, JSON.stringify(memos));

  const uid = await getUserId();
  if (!uid) return;

  if (memos.length > 0) {
    await supabase.from("expression_memos").upsert(
      memos.map(m => ({
        user_id: uid,
        memo_id: m.id,
        word: m.word,
        content: m.content,
        examples: m.examples,
        tags: m.tags,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,memo_id" }
    );
  }
}
