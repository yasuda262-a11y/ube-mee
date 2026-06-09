"use client";

import { Bold, Underline } from "lucide-react";
import { wrapSelection } from "../lib/richText";

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  /** ツールバーの色テーマ: "indigo"(デフォルト) | "amber" */
  theme?: "indigo" | "amber";
}

export default function FormatToolbar({ textareaRef, onChange, theme = "indigo" }: Props) {
  const base =
    theme === "amber"
      ? "text-amber-600 hover:bg-amber-200 active:bg-amber-300"
      : "text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200";

  function apply(marker: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    wrapSelection(ta, marker, onChange);
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); apply("**"); }}
        className={`flex items-center justify-center w-7 h-7 rounded-lg font-bold text-sm transition-colors ${base}`}
        title="太字 (**text**)"
      >
        <Bold size={14} />
      </button>
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); apply("__"); }}
        className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${base}`}
        title="下線 (__text__)"
      >
        <Underline size={14} />
      </button>
    </div>
  );
}
