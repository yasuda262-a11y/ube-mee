/**
 * シンプルなリッチテキスト — 記法 → React 要素
 *
 * 対応記法:
 *   **text**   → <strong> (太字)
 *   __text__   → <u>      (下線)
 *
 * 入れ子も対応 (**__text__** など)。
 * 改行は <br> に変換。
 */

import React from "react";

type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; children: Segment[] }
  | { type: "underline"; children: Segment[] };

function parse(src: string): Segment[] {
  // bold と underline を同時に検出する簡易パーサー
  const result: Segment[] = [];
  let i = 0;

  function read(stopAt?: string): Segment[] {
    const segs: Segment[] = [];
    let buf = "";

    function flush() {
      if (buf) { segs.push({ type: "text", value: buf }); buf = ""; }
    }

    while (i < src.length) {
      // 終端マーカー検出
      if (stopAt && src.startsWith(stopAt, i)) {
        i += stopAt.length;
        break;
      }
      if (src.startsWith("**", i)) {
        flush();
        i += 2;
        segs.push({ type: "bold", children: read("**") });
      } else if (src.startsWith("__", i)) {
        flush();
        i += 2;
        segs.push({ type: "underline", children: read("__") });
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
  return segs.map((seg) => {
    const k = ++keyCounter;
    if (seg.type === "text") {
      // 改行を <br> に
      const parts = seg.value.split("\n");
      return parts.map((p, pi) =>
        pi === parts.length - 1
          ? <React.Fragment key={`${k}-${pi}`}>{p}</React.Fragment>
          : <React.Fragment key={`${k}-${pi}`}>{p}<br /></React.Fragment>
      );
    }
    if (seg.type === "bold") {
      return <strong key={k} className="font-bold">{renderSegments(seg.children)}</strong>;
    }
    return <u key={k} className="underline [text-decoration-skip-ink:none]">{renderSegments(seg.children)}</u>;
  });
}

/** Markdown 記法テキストを React ノードに変換 */
export function renderRichText(text: string): React.ReactNode {
  keyCounter = 0;
  const segs = parse(text);
  return <>{renderSegments(segs)}</>;
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
