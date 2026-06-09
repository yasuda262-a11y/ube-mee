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
    return <u key={k} className="underline underline-offset-2">{renderSegments(seg.children)}</u>;
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
 * テキストエリアの選択範囲を指定記法で囲む。
 * `ref` と `onChange` を受け取り、操作後に onChange を呼ぶ。
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

  // すでに囲まれている場合は解除
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    const next = before + inner + after;
    onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + inner.length);
    });
    return;
  }

  const next = before + marker + selected + marker + after;
  onChange(next);
  requestAnimationFrame(() => {
    textarea.focus();
    if (selected) {
      textarea.setSelectionRange(start + marker.length, end + marker.length);
    } else {
      const pos = start + marker.length;
      textarea.setSelectionRange(pos, pos);
    }
  });
}
