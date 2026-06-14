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
  bold?: boolean;
  underline?: boolean;
};

/**
 * テキストセグメントを **bold** / ++underline++ マークアップ付きで単語分割する。
 * マーカーは除去し、各単語に bold/underline フラグを付与して返す。
 * initBold/initUnder: blank を跨いで状態を引き継ぐ場合に指定する。
 */
function parseFormattedWords(
  text: string,
  initBold = false,
  initUnder = false,
): { words: Array<{ word: string; bold: boolean; underline: boolean }>; finalBold: boolean; finalUnder: boolean } {
  const result: Array<{ word: string; bold: boolean; underline: boolean }> = [];

  // **...** と ++...++ を交互にパース
  const re = /(\*\*|\+\+)/g;
  let isBold = initBold;
  let isUnder = initUnder;
  let last = 0;

  // (a), (b), (1), (iv), a), b), 1) などのマーカーはそのまま維持する
  const KEEP_AS_ONE = /^(\([a-z]\)|\([ivxlcdm]+\)|\(\d+\)|[a-z]\)|\d+\)|[ivxlcdm]+\))$/i;

  const flushSegment = (seg: string) => {
    const rawWords = seg.split(/\s+/).filter((w) => w.length > 0);
    for (const raw of rawWords) {
      // マーカー系はそのまま
      if (KEEP_AS_ONE.test(raw)) {
        result.push({ word: raw, bold: isBold, underline: isUnder });
        continue;
      }
      let word = raw;
      // 先頭の ( を独立トークンに分離
      if (word.startsWith("(")) {
        result.push({ word: "(", bold: false, underline: false });
        word = word.slice(1);
        if (!word) continue;
      }
      // 末尾の句読点・) を1文字ずつ独立トークンに分離
      const trailingChars: string[] = [];
      while (word.length > 0 && /[,.:;)]/.test(word[word.length - 1])) {
        trailingChars.unshift(word[word.length - 1]);
        word = word.slice(0, -1);
      }
      if (!word) {
        for (const ch of trailingChars) result.push({ word: ch, bold: false, underline: false });
        continue;
      }
      // アポストロフィで分離: contractor's → contractor + 's
      const apoIdx = word.indexOf("'");
      if (apoIdx > 0) {
        result.push({ word: word.slice(0, apoIdx), bold: isBold, underline: isUnder });
        result.push({ word: word.slice(apoIdx), bold: false, underline: false });
      } else {
        result.push({ word, bold: isBold, underline: isUnder });
      }
      for (const ch of trailingChars) result.push({ word: ch, bold: false, underline: false });
    }
  };

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    flushSegment(text.slice(last, match.index));
    last = match.index + match[0].length;
    if (match[0] === "**") isBold = !isBold;
    else isUnder = !isUnder;
  }
  flushSegment(text.slice(last));

  return { words: result, finalBold: isBold, finalUnder: isUnder };
}

export function parseTokens(
  context: string,
  blanks: { idx: number; answer: string }[]
): Token[] {
  const tokens: Token[] = [];
  let tokenIdx = 0;
  const lines = context.split("\n");

  lines.forEach((line, lineIdx) => {
    const parts = line.split(/(__BLANK_\d+__)/g);
    let curBold = false;
    let curUnder = false;
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
          ...(curBold && { bold: true }),
          ...(curUnder && { underline: true }),
        });
      } else {
        // **bold** / ++underline++ マークアップを解析しつつ単語分割・句読点分離
        const { words, finalBold, finalUnder } = parseFormattedWords(part, curBold, curUnder);
        curBold = finalBold;
        curUnder = finalUnder;
        for (const { word, bold, underline } of words) {
          tokens.push({
            idx: tokenIdx++,
            text: word,
            type: "word",
            lineIdx,
            ...(bold && { bold: true }),
            ...(underline && { underline: true }),
          });
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

const OVERRIDE_KEY = "ube-blank-overrides-v4";

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
  // Supabase に非同期保存（循環参照を避けるため動的インポート）
  if (typeof window !== "undefined") {
    import("./db").then(({ saveOverrideRemote }) => {
      saveOverrideRemote(cardId, ov).catch(() => {});
    });
  }
}

export function resetOverride(cardId: number) {
  const store = loadStore();
  delete store[cardId];
  saveStore(store);
}

// ---- Partial blank helpers ------------------------------------------------

/** blank answer を括弧・句読点単位に分割する（表示・インデックス管理の最小単位） */
const BLANK_KEEP_AS_ONE = /^(\([a-z]\)|\([ivxlcdm]+\)|\(\d+\)|[a-z]\)|\d+\)|[ivxlcdm]+\))$/i;

function splitWordToSubTokens(word: string): string[] {
  if (BLANK_KEEP_AS_ONE.test(word)) return [word];
  const parts: string[] = [];
  let w = word;
  if (w.startsWith("(")) { parts.push("("); w = w.slice(1); }
  const trailing: string[] = [];
  while (w.length > 0 && /[,.:;)]/.test(w[w.length - 1])) {
    trailing.unshift(w[w.length - 1]);
    w = w.slice(0, -1);
  }
  if (w) parts.push(w);
  parts.push(...trailing);
  return parts.filter(p => p.length > 0);
}

/** blank answer を sub-token の flat list に展開する（インデックスは flat 通し番号） */
export function getBlankSubTokens(answer: string): string[] {
  return answer.split(" ").flatMap(word => splitWordToSubTokens(word));
}

/**
 * originalBlank の answer 文字列を、有効／無効チャンクに分割する。
 * disabledIdxs は getBlankSubTokens() の flat インデックス。
 */
export type BlankWordChunk =
  | { type: "enabled"; text: string; wordStart: number; wordEnd: number }
  | { type: "disabled"; text: string };

export function splitBlankIntoChunks(
  answer: string,
  disabledIdxs: Set<number>
): BlankWordChunk[] {
  const subTokens = getBlankSubTokens(answer);
  const chunks: BlankWordChunk[] = [];
  let current: BlankWordChunk | null = null;

  for (let i = 0; i < subTokens.length; i++) {
    const disabled = disabledIdxs.has(i);
    if (!disabled) {
      if (current?.type === "enabled") {
        (current as { type: "enabled"; text: string; wordStart: number; wordEnd: number }).text += " " + subTokens[i];
        (current as { type: "enabled"; text: string; wordStart: number; wordEnd: number }).wordEnd = i;
      } else {
        if (current) chunks.push(current);
        current = { type: "enabled", text: subTokens[i], wordStart: i, wordEnd: i };
      }
    } else {
      if (current?.type === "disabled") {
        current.text += " " + subTokens[i];
      } else {
        if (current) chunks.push(current);
        current = { type: "disabled", text: subTokens[i] };
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** originalBlank の有効 sub-token のみを結合した answer を返す */
export function getEnabledAnswer(answer: string, disabledIdxs: Set<number>): string {
  return getBlankSubTokens(answer)
    .filter((_, i) => !disabledIdxs.has(i))
    .join(" ")
    .trim();
}

// ---- Active blank computation ---------------------------------------------

export type SubBlank = {
  id: string;
  answer: string;
};

export type ActiveBlank = {
  id: string;         // 一意キー
  leadTokenIdx: number;   // 描画の基準となるトークン idx
  answer: string;     // ユーザーが入力すべき答え（単一 or 全体）
  /** originalBlank の場合、部分無効化チャンク（描画用） */
  chunks?: BlankWordChunk[];
  /** カスタムグループ全体の token.idx（複数単語グループ用） */
  groupTokenIdxs?: number[];
  /**
   * 有効チャンクが2つ以上ある場合、チャンクごとに独立した空欄として入力させる。
   * インデックス順は enabled chunk の出現順に対応。
   */
  subBlanks?: SubBlank[];
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

    let subBlanks: SubBlank[] | undefined;
    if (chunks) {
      const enabledChunks = chunks.filter(c => c.type === "enabled") as Array<{ type: "enabled"; text: string }>;
      if (enabledChunks.length > 1) {
        subBlanks = enabledChunks.map((c, ci) => ({
          id: `orig-${t.blankIdx}-${ci}`,
          answer: c.text,
        }));
      }
    }

    result.push({
      id: `orig-${t.blankIdx}`,
      leadTokenIdx: t.idx,
      answer,
      chunks,
      subBlanks,
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
