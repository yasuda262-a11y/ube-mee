/**
 * トークンベースの伏字カスタマイズ。
 *
 * context 文字列をパースして Token[] を生成し、
 * BlankOverride（どのトークンを伏字にするか）を localStorage に保存する。
 */

// ---- Token ----------------------------------------------------------------

export type Token = {
  idx: number;               // token 配列内の順番（安定した識別子として使用）
  text: string;              // 表示テキスト
  type: "originalBlank" | "word";
  blankIdx?: number;         // 0-based index into card.blanks[] (originalBlank のみ)
  lineIdx: number;           // context を \n で分割したときの行番号
};

export function parseTokens(
  context: string,
  blanks: { idx: number; answer: string }[]
): Token[] {
  const tokens: Token[] = [];
  let tokenIdx = 0;
  const lines = context.split("\n");

  lines.forEach((line, lineIdx) => {
    const parts = line.split(/(__BLANK_\d+__)/g);
    for (const part of parts) {
      if (!part) continue;
      const m = part.match(/^__BLANK_(\d+)__$/);
      if (m) {
        const blankNum = parseInt(m[1]);
        const blankIdx = blankNum - 1;
        tokens.push({
          idx: tokenIdx++,
          text: blanks[blankIdx]?.answer ?? `[${blankNum}]`,
          type: "originalBlank",
          blankIdx,
          lineIdx,
        });
      } else {
        const words = part.split(/\s+/).filter((w) => w.length > 0);
        for (const word of words) {
          tokens.push({ idx: tokenIdx++, text: word, type: "word", lineIdx });
        }
      }
    }
  });

  return tokens;
}

// ---- Override -------------------------------------------------------------

export type BlankOverride = {
  /** 元々伏字だったが OFF にした blankIdx（0-based, card.blanks[]） */
  disabledOriginalBlanks: number[];
  /** 元はテキストだったが伏字に追加した token.idx */
  customBlankedTokens: number[];
};

const OVERRIDE_KEY = "ube-blank-overrides-v2";

type OverrideStore = Record<number, BlankOverride>;

function loadStore(): OverrideStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function saveStore(store: OverrideStore) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(store));
}

export function getOverride(cardId: number): BlankOverride {
  const s = loadStore();
  return s[cardId] ?? { disabledOriginalBlanks: [], customBlankedTokens: [] };
}

export function saveOverride(cardId: number, override: BlankOverride) {
  const store = loadStore();
  if (
    override.disabledOriginalBlanks.length === 0 &&
    override.customBlankedTokens.length === 0
  ) {
    delete store[cardId];
  } else {
    store[cardId] = override;
  }
  saveStore(store);
}

export function resetOverride(cardId: number) {
  const store = loadStore();
  delete store[cardId];
  saveStore(store);
}

/** トークンを toggle して新しい BlankOverride を返す（保存は呼び出し側で行う） */
export function toggleToken(token: Token, override: BlankOverride): BlankOverride {
  const next = {
    disabledOriginalBlanks: [...override.disabledOriginalBlanks],
    customBlankedTokens: [...override.customBlankedTokens],
  };

  if (token.type === "originalBlank") {
    const s = new Set(next.disabledOriginalBlanks);
    s.has(token.blankIdx!) ? s.delete(token.blankIdx!) : s.add(token.blankIdx!);
    next.disabledOriginalBlanks = [...s];
  } else {
    const s = new Set(next.customBlankedTokens);
    s.has(token.idx) ? s.delete(token.idx) : s.add(token.idx);
    next.customBlankedTokens = [...s];
  }

  return next;
}

/** 現在の override から「伏字にすべき token.idx の Set」を導出 */
export function getEffectiveBlankedSet(
  tokens: Token[],
  override: BlankOverride
): Set<number> {
  const disabled = new Set(override.disabledOriginalBlanks);
  const custom = new Set(override.customBlankedTokens);
  const result = new Set<number>();

  for (const t of tokens) {
    if (t.type === "originalBlank" && !disabled.has(t.blankIdx!)) {
      result.add(t.idx);
    } else if (t.type === "word" && custom.has(t.idx)) {
      result.add(t.idx);
    }
  }
  return result;
}
