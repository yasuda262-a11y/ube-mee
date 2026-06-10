"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { X, Mail, Lock, LogIn, UserPlus, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function AuthModal({ onClose }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage({ type: "error", text: error.message });
      else onClose();
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage({ type: "error", text: error.message });
      else setMessage({ type: "success", text: "確認メールを送信しました。メールのリンクをクリックして登録を完了してください。" });
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setMessage({ type: "error", text: error.message });
      else setMessage({ type: "success", text: "パスワードリセットメールを送信しました。" });
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-gray-800 mb-1">
          {mode === "login" ? "ログイン" : mode === "signup" ? "アカウント作成" : "パスワードリセット"}
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          ログインするとデータがクラウドに保存され、どのデバイスからでもアクセスできます。
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="メールアドレス"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>
          {mode !== "reset" && (
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password" required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="パスワード（6文字以上）"
                minLength={6}
                className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {message && (
            <p className={`text-xs px-3 py-2 rounded-xl ${
              message.type === "error" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
            }`}>{message.text}</p>
          )}

          <button type="submit" disabled={loading}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60">
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {mode === "login" ? "ログイン" : mode === "signup" ? "アカウント作成" : "送信"}
          </button>
        </form>

        <div className="flex flex-col gap-1 mt-4 text-center">
          {mode === "login" && (
            <>
              <button onClick={() => { setMode("signup"); setMessage(null); }}
                className="text-xs text-indigo-500 hover:underline">
                アカウントをお持ちでない方はこちら
              </button>
              <button onClick={() => { setMode("reset"); setMessage(null); }}
                className="text-xs text-gray-400 hover:underline">
                パスワードを忘れた方
              </button>
            </>
          )}
          {(mode === "signup" || mode === "reset") && (
            <button onClick={() => { setMode("login"); setMessage(null); }}
              className="text-xs text-indigo-500 hover:underline">
              ログイン画面に戻る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
