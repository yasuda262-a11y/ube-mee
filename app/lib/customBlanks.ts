/**
 * トークンベースの伏字カスタマイズ（v3）
 *
 * 変更点:
 * - originalBlank の単語単位の部分解除 (partialDisabledWords)
 * - 複数単語をまとめてカスタム伏字にするグループ機能 (customBlanks: number[][])
 */

// ---- Token ----------------------------------------------------------------

export type Token = {
  idx: number;
  text: string;
  type: "originalBlank" | "word";
  blankIdx?: number;   // 0-based into card.blanks[] (originalBlank のみ)
  lineIdx: number;
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
  /** originalBlank を丸ごと OFF にした blankIdx 一覧 */
  disabledOriginalBlanks: number[];
  /** originalBlank の単語単位の無効化: blankIdx → 無効化した sub-word インデックス配列 */
  partialDisabledWords: Record<number, number[]>;
  /** カスタム伏字グループ: 各要素は token.idx の配列（複数単語で1つの伏字を形成） */
  customBlanks: number[][];
};

const OVERRIDE_KEY = "ube-blank-overrides-v3";

type OverrideStore = Record<number, BlankOverride>;

function loadStore(): OverrideStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(OVERRIDE_KEY) ?? "{}"); }
  catch { return {}; }
}
function saveStore(s: OverrideStore) {
  localStorage.setItem(OVERRIDE_KEY, JSON.stringify(s));
}

const EMPTY: BlankOverride = {
  disabledOriginalBlanks: [],
  partialDisabledWords: {},
  customBlanks: [],
};

export function getOverride(cardId: number): BlankOverride {
  return loadStore()[cardId] ?? { ...EMPTY };
}

export function saveOverride(cardId: number, ov: BlankOverride) {
  const store = loadStore();
  const isEmpty =
    ov.disabledOriginalBlanks.length === 0 &&
    Object.keys(ov.partialDisabledWords).length === 0 &&
    ov.customBlanks.length === 0;
  if (isEmpty) delete store[cardId];
  else store[cardId] = ov;
  saveStore(store);
}

export function resetOverride(cardId: number) {
  const store = loadStore();
  delete store[cardId];
  saveStore(store);
}

// ---- Partial blank helpers ------------------------------------------------

/**
 * originalBlank の answer 文字列を、有効／無効チャンクに分割する。
 * 隣接する同種の単語はひとつのチャンクにまとめる。
 */
export type BlankWordChunk =
  | { type: "enabled"; text: string; wordStart: number; wordEnd: number }
  | { type: "disabled"; text: string };

export function splitBlankIntoChunks(
  answer: string,
  disabledWordIdxs: Set<number>
): BlankWordChunk[] {
  const words = answer.split(" ");
  const chunks: BlankWordChunk[] = [];
  let current: BlankWordChunk | null = null;
  let wi = 0;

  for (let i = 0; i < words.length; i++) {
    const disabled = disabledWordIdxs.has(i);
    if (!disabled) {
      if (current?.type === "enabled") {
        (current as { type: "enabled"; text: string; wordStart: number; wordEnd: number }).text += " " + words[i];
        (current as { type: "enabled"; text: string; wordStart: number; wordEnd: number }).wordEnd = i;
      } else {
        if (current) chunks.push(current);
        current = { type: "enabled", text: words[i], wordStart: i, wordEnd: i };
        wi++;
      }
    } else {
      if (current?.type === "disabled") {
        current.text += " " + words[i];
      } else {
        if (current) chunks.push(current);
        current = { type: "disabled", text: words[i] };
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** originalBlank の有効単語のみを結合した answer を返す */
export function getEnabledAnswer(answer: string, disabledWordIdxs: Set<number>): string {
  return answer
    .split(" ")
    .filter((_, i) => !disabledWordIdxs.has(i))
    .join(" ");
}

// ---- Active blank computation ---------------------------------------------

export type ActiveBlank = {
  id: string;         // 一意キー
  leadTokenIdx: number;   // 描画の基準となるトークン idx
  answer: string;     // ユーザーが入力すべき答え
  /** originalBlank の場合、部分無効化チャンク（描画用） */
  chunks?: BlankWordChunk[];
  /** カスタムグループ全体の token.idx（複数単語グループ用） */
  groupTokenIdxs?: number[];
};

/**
 * override を元に「実際に出題する空欄」リストを token 順で返す。
 */
export function getActiveBlanks(tokens: Token[], override: BlankOverride): ActiveBlank[] {
  const result: ActiveBlank[] = [];
  const disabledOrigSet = new Set(override.disabledOriginalBlanks);

  // --- original blanks ---
  for (const t of tokens) {
    if (t.type !== "originalBlank") continue;
    if (disabledOrigSet.has(t.blankIdx!)) continue;

    const disabledWords = new Set(override.partialDisabledWords[t.blankIdx!] ?? []);
    const answer = getEnabledAnswer(t.text, disabledWords);
    if (!answer.trim()) continue; // 全単語無効化 → スキップ

    const chunks = disabledWords.size > 0
      ? splitBlankIntoChunks(t.text, disabledWords)
      : undefined;

    result.push({
      id: `orig-${t.blankIdx}`,
      leadTokenIdx: t.idx,
      answer,
      chunks,
    });
  }

  // --- custom blank groups ---
  for (let gi = 0; gi < override.customBlanks.length; gi++) {
    const group = override.customBlanks[gi].slice().sort((a, b) => a - b);
    if (group.length === 0) continue;
    const groupTokens = tokens.filter((t) => group.includes(t.idx));
    const answer = groupTokens.map((t) => t.text).join(" ");
    result.push({
      id: `custom-${gi}`,
      leadTokenIdx: group[0],
      answer,
      groupTokenIdxs: group,
    });
  }

  // token 順にソート
  result.sort((a, b) => a.leadTokenIdx - b.leadTokenIdx);
  return result;
}

/** token.idx → ActiveBlank のマップ（leadTokenIdx で引く） */
export function buildBlankMap(
  activeBlanks: ActiveBlank[]
): Map<number, { blank: ActiveBlank; number: number }> {
  const m = new Map<number, { blank: ActiveBlank; number: number }>();
  activeBlanks.forEach((b, i) => m.set(b.leadTokenIdx, { blank: b, number: i + 1 }));
  return m;
}

/** カスタムグループに属するが lead ではない token.idx のセット */
export function buildSkipSet(activeBlanks: ActiveBlank[]): Set<number> {
  const skip = new Set<number>();
  for (const b of activeBlanks) {
    if (!b.groupTokenIdxs) continue;
    for (const idx of b.groupTokenIdxs.slice(1)) skip.add(idx);
  }
  return skip;
}
