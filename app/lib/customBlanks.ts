/**
 * カードごとの伏字カスタマイズ設定を localStorage で管理する。
 * Record<cardId, disabledIdxSet> — disabled な blank idx（0-based）の配列を保存。
 */

const KEY = "ube-custom-blanks";

type Store = Record<number, number[]>; // cardId → disabled blank indices (0-based)

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

/** 指定カードの無効化済み blank インデックス（0-based）のセットを返す */
export function getDisabled(cardId: number): Set<number> {
  const store = load();
  return new Set(store[cardId] ?? []);
}

/** 指定カードの blank idx を toggle（有効 ↔ 無効）して保存 */
export function toggleBlank(cardId: number, blankIdx: number): Set<number> {
  const store = load();
  const disabled = new Set(store[cardId] ?? []);
  if (disabled.has(blankIdx)) {
    disabled.delete(blankIdx);
  } else {
    disabled.add(blankIdx);
  }
  store[cardId] = [...disabled];
  save(store);
  return disabled;
}

/** 指定カードの設定をリセット（全 blank を有効に戻す） */
export function resetCard(cardId: number) {
  const store = load();
  delete store[cardId];
  save(store);
}
