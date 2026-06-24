/**
 * リッチテキスト — 記法 → React 要素
 *
 * 対応記法:
 *   ***text***  → <strong><em> (太字斜体)
 *   **text**    → <strong>    (太字)
 *   __text__    → <u>         (下線)
 *   _text_      → <em>        (斜体)
 *
 * 入れ子も対応。改行は <br> に変換。
 */

import React from "react";

type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; children: Segment[] }
  | { type: "italic"; children: Segment[] }
  | { type: "boldItalic"; children: Segment[] }
  | { type: "underline"; children: Segment[] }
  | { type: "answer"; children: Segment[] };

function parse(src: string): Segment[] {
  let i = 0;

  function read(stopAt?: string): Segment[] {
    const segs: Segment[] = [];
    let buf = "";

    function flush() {
      if (buf) { segs.push({ type: "text", value: buf }); buf = ""; }
    }

    while (i < src.length) {
      // 終端マーカー検出（長いものを優先）
      if (stopAt && src.startsWith(stopAt, i)) {
        i += stopAt.length;
        break;
      }
      // ++ (answer highlight)
      if (src.startsWith("++", i)) {
        flush(); i += 2;
        segs.push({ type: "answer", children: read("++") });
      // *** (boldItalic) — ** より先に検出
      } else if (src.startsWith("***", i)) {
        flush(); i += 3;
        segs.push({ type: "boldItalic", children: read("***") });
      // ** (bold)
      } else if (src.startsWith("**", i)) {
        flush(); i += 2;
        segs.push({ type: "bold", children: read("**") });
      // * (italic single asterisk)
      } else if (src[i] === "*") {
        flush(); i++;
        segs.push({ type: "italic", children: read("*") });
      // __ (underline) — _ より先に検出
      } else if (src.startsWith("__", i)) {
        flush(); i += 2;
        segs.push({ type: "underline", children: read("__") });
      // _ (italic)
      } else if (src[i] === "_") {
        flush(); i++;
        segs.push({ type: "italic", children: read("_") });
      } else {
        buf += src[i++];
      }
    }
    flush();
    return segs;
  }

  return read();
}

let keyCounter = 0;
function renderSegments(segs: Segment[]): React.ReactNode[] {
  return segs.flatMap((seg) => {
    const k = ++keyCounter;
    if (seg.type === "text") {
      const parts = seg.value.split("\n");
      return parts.map((p, pi) =>
        pi === parts.length - 1
          ? <React.Fragment key={`${k}-${pi}`}>{p}</React.Fragment>
          : <React.Fragment key={`${k}-${pi}`}>{p}<br /></React.Fragment>
      );
    }
    if (seg.type === "bold") {
      return [<strong key={k} className="font-bold">{renderSegments(seg.children)}</strong>];
    }
    if (seg.type === "italic") {
      return [<em key={k} className="italic">{renderSegments(seg.children)}</em>];
    }
    if (seg.type === "boldItalic") {
      return [<strong key={k} className="font-bold italic">{renderSegments(seg.children)}</strong>];
    }
    if (seg.type === "answer") {
      return [<span key={k} className="font-bold underline decoration-2 underline-offset-[3px] [text-decoration-skip-ink:none]">{renderSegments(seg.children)}</span>];
    }
    return [<u key={k} className="underline [text-decoration-skip-ink:none]">{renderSegments(seg.children)}</u>];
  });
}

/** Markdown 記法テキストを React ノードに変換 */
export function renderRichText(text: string): React.ReactNode {
  keyCounter = 0;
  const segs = parse(text);
  return <>{renderSegments(segs)}</>;
}

/** セグメントツリーからプレーンテキストを抽出（ハイライト位置計算用） */
function extractPlain(segs: Segment[]): string {
  return segs.map((seg) =>
    seg.type === "text" ? seg.value : extractPlain((seg as { children: Segment[] }).children ?? [])
  ).join("");
}

/** プレーンテキスト座標のハイライト範囲をセグメントツリーに適用してレンダリング */
function applyHl(
  segs: Segment[],
  ranges: { s: number; e: number }[],
  off: { v: number }
): React.ReactNode[] {
  return segs.flatMap((seg) => {
    const k = ++keyCounter;
    if (seg.type === "text") {
      const segStart = off.v;
      const segEnd = off.v + seg.value.length;
      off.v = segEnd;
      const overlaps = ranges.filter((r) => r.e > segStart && r.s < segEnd);
      if (!overlaps.length) return [<React.Fragment key={k}>{seg.value}</React.Fragment>];
      // カット位置を収集
      const cuts = new Set([0, seg.value.length]);
      for (const r of overlaps) {
        cuts.add(Math.max(0, r.s - segStart));
        cuts.add(Math.min(seg.value.length, r.e - segStart));
      }
      const sorted = [...cuts].sort((a, b) => a - b);
      return sorted.slice(0, -1).flatMap((start, i) => {
        const end = sorted[i + 1];
        if (start === end) return [];
        const chunk = seg.value.slice(start, end);
        const absStart = segStart + start;
        const isHl = ranges.some((r) => r.s <= absStart && r.e > absStart);
        return isHl
          ? [<mark key={`${k}-h${i}`} className="bg-yellow-200 rounded-sm">{chunk}</mark>]
          : [<React.Fragment key={`${k}-${i}`}>{chunk}</React.Fragment>];
      });
    }
    const children = applyHl((seg as { children: Segment[] }).children ?? [], ranges, off);
    if (seg.type === "bold")      return [<strong key={k} className="font-bold">{children}</strong>];
    if (seg.type === "italic")    return [<em key={k} className="italic">{children}</em>];
    if (seg.type === "boldItalic") return [<strong key={k} className="font-bold italic">{children}</strong>];
    if (seg.type === "answer")    return [<span key={k} className="font-bold underline decoration-2 underline-offset-[3px] [text-decoration-skip-ink:none]">{children}</span>];
    return [<u key={k} className="underline [text-decoration-skip-ink:none]">{children}</u>];
  });
}

/**
 * Markdown テキストをパースしたうえで、プレーンテキスト座標のハイライト範囲を適用してレンダリング。
 * bold/italic のマーカーを壊さずにハイライトを挿入できる。
 */
export function renderRichTextWithHighlights(
  rawText: string,
  hlRanges: { s: number; e: number }[]
): React.ReactNode {
  keyCounter = 0;
  const segs = parse(rawText);
  if (!hlRanges.length) return <>{renderSegments(segs)}</>;
  const off = { v: 0 };
  return <>{applyHl(segs, hlRanges, off)}</>;
}

/**
 * rawText のプレーンテキスト（マーカー除去後）を返す。
 * renderRichTextWithHighlights に渡す範囲計算と座標を合わせるために使う。
 */
export function getPlainText(rawText: string): string {
  return extractPlain(parse(rawText));
}

// ---- フォーマットツールバー (クライアントコンポーネント向け) -----------------

/**
 * テキストエリアの選択範囲を指定記法でラップ／アンラップする。
 *
 * アンラップ条件（いずれか）:
 *   A. 選択テキスト自体が marker で囲まれている  → 選択内のマーカーを除去
 *   B. 選択範囲の直前・直後に marker がある       → 外側のマーカーを除去
 *   C. 選択なしでカーソルが marker ペアの内側にある → ペアを除去
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  marker: string,
  onChange: (v: string) => void
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);
  const ml = marker.length;

  // ---- A: 選択テキスト自体が marker で囲まれている ----
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= ml * 2) {
    const inner = selected.slice(ml, selected.length - ml);
    onChange(before + inner + after);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + inner.length);
    });
    return;
  }

  // ---- B: 選択範囲の直前・直後に marker がある ----
  if (before.endsWith(marker) && after.startsWith(marker)) {
    const newBefore = before.slice(0, before.length - ml);
    const newAfter = after.slice(ml);
    onChange(newBefore + selected + newAfter);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start - ml, end - ml);
    });
    return;
  }

  // ---- C: カーソル位置（選択なし）が marker ペアの内側 ----
  if (start === end) {
    // カーソル前後を走査して最も近いマーカーペアを探す
    const markerRegex = new RegExp(
      marker.replace(/\*/g, "\\*").replace(/_/g, "\\_") + "([\\s\\S]*?)" +
      marker.replace(/\*/g, "\\*").replace(/_/g, "\\_"),
      "g"
    );
    let m: RegExpExecArray | null;
    while ((m = markerRegex.exec(value)) !== null) {
      const pairStart = m.index;
      const pairEnd = m.index + m[0].length;
      if (pairStart < start && start <= pairEnd - ml) {
        // カーソルはこのペアの内側
        const inner = m[1];
        onChange(value.slice(0, pairStart) + inner + value.slice(pairEnd));
        requestAnimationFrame(() => {
          textarea.focus();
          const newPos = Math.min(start - ml, pairStart + inner.length);
          textarea.setSelectionRange(newPos, newPos);
        });
        return;
      }
    }
  }

  // ---- ラップ（新規追加）----
  const next = before + marker + selected + marker + after;
  onChange(next);
  requestAnimationFrame(() => {
    textarea.focus();
    if (selected) {
      textarea.setSelectionRange(start + ml, end + ml);
    } else {
      const pos = start + ml;
      textarea.setSelectionRange(pos, pos);
    }
  });
}

/**
 * textarea の keydown イベントで Cmd/Ctrl+B・U を処理するハンドラを返す。
 * 各テキストエリアの onKeyDown に渡して使用する。
 */
export function makeFormatKeyHandler(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  onChange: (v: string) => void
) {
  return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) wrapSelection(ta, "**", onChange);
    } else if (e.key === "u" || e.key === "U") {
      e.preventDefault();
      const ta = textareaRef.current;
      if (ta) wrapSelection(ta, "__", onChange);
    }
  };
}
