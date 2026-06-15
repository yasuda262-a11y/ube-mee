"use client";

import { useMemo, useState } from "react";
import type { AccuracySnapshot } from "../lib/accuracyHistory";

const SUBJECT_COLORS: Record<string, string> = {
  "AGENCY": "#7c3aed",
  "CONTRACTS": "#2563eb",
  "TORTS": "#ea580c",
  "CONSTITUTIONAL LAW": "#dc2626",
  "CRIMINAL LAW & PROCEDURE": "#be123c",
  "CIVIL PROCEDURE": "#0891b2",
  "EVIDENCE": "#059669",
  "REAL PROPERTY": "#d97706",
  "CORPORATIONS & LLC'S": "#4338ca",
  "PARTNERSHIPS": "#0d9488",
};

const SUBJECT_SHORT: Record<string, string> = {
  "AGENCY": "AG",
  "CONTRACTS": "CON",
  "TORTS": "TOR",
  "CONSTITUTIONAL LAW": "CON L",
  "CRIMINAL LAW & PROCEDURE": "CRI",
  "CIVIL PROCEDURE": "CIV",
  "EVIDENCE": "EVI",
  "REAL PROPERTY": "REA",
  "CORPORATIONS & LLC'S": "CORP",
  "PARTNERSHIPS": "PAR",
};

type Props = {
  history: AccuracySnapshot[];
};

export default function AccuracyChart({ history }: Props) {
  const [activeSubjects, setActiveSubjects] = useState<Set<string>>(new Set());

  const subjects = useMemo(() => {
    if (history.length === 0) return [];
    return Object.keys(history[history.length - 1].bySubject);
  }, [history]);

  const toggleSubject = (s: string) => {
    setActiveSubjects((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  if (history.length < 2) {
    return (
      <div className="bg-white/10 rounded-3xl p-5 text-white">
        <p className="text-xs text-white/60 mb-1">正答率の推移</p>
        <p className="text-xs text-white/40 mt-3 text-center">2日以上のデータが集まると表示されます</p>
      </div>
    );
  }

  // Chart dimensions
  const W = 560, H = 160, PL = 32, PR = 12, PT = 12, PB = 24;
  const cw = W - PL - PR;
  const ch = H - PT - PB;

  const n = history.length;
  const xOf = (i: number) => PL + (i / (n - 1)) * cw;
  const yOf = (v: number) => PT + ch - (v / 100) * ch;

  const polyline = (vals: number[]) =>
    vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");

  const yTicks = [0, 25, 50, 75, 100];

  // X axis labels: show first, last, and a few in between
  const xLabelIndices = useMemo(() => {
    if (n <= 7) return history.map((_, i) => i);
    const step = Math.ceil((n - 1) / 4);
    const idx = new Set<number>([0]);
    for (let i = step; i < n - 1; i += step) idx.add(i);
    idx.add(n - 1);
    return Array.from(idx).sort((a, b) => a - b);
  }, [n, history]);

  const formatDate = (d: string) => {
    const parts = d.split("-");
    return `${parts[1]}/${parts[2]}`;
  };

  return (
    <div className="bg-white/10 rounded-3xl p-5 text-white">
      <p className="text-xs text-white/60 mb-3">正答率の推移</p>

      {/* SVG Chart */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
          {/* Grid lines */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PL} y1={yOf(t)} x2={W - PR} y2={yOf(t)}
                stroke="rgba(255,255,255,0.1)" strokeWidth="1"
              />
              <text x={PL - 4} y={yOf(t) + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.4)">
                {t}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {xLabelIndices.map((i) => (
            <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">
              {formatDate(history[i].date)}
            </text>
          ))}

          {/* Subject lines */}
          {subjects.filter((s) => activeSubjects.has(s)).map((s) => (
            <g key={s}>
              <polyline
                points={polyline(history.map((h) => h.bySubject[s] ?? 0))}
                fill="none" stroke={SUBJECT_COLORS[s] ?? "#888"} strokeWidth="1.5" strokeOpacity="0.7"
              />
              {history.map((h, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(h.bySubject[s] ?? 0)} r="2"
                  fill={SUBJECT_COLORS[s] ?? "#888"} fillOpacity="0.8" />
              ))}
            </g>
          ))}

          {/* Overall line (always shown, on top) */}
          <polyline
            points={polyline(history.map((h) => h.overall))}
            fill="none" stroke="#fbbf24" strokeWidth="2.5"
          />
          {history.map((h, i) => (
            <circle key={i} cx={xOf(i)} cy={yOf(h.overall)} r="3" fill="#fbbf24" />
          ))}

          {/* Latest value label */}
          <text
            x={xOf(n - 1) + 4} y={yOf(history[n - 1].overall) - 4}
            fontSize="10" fill="#fbbf24" fontWeight="bold"
          >
            {history[n - 1].overall}%
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px] text-white/80 mr-2">
          <span className="inline-block w-5 h-0.5 bg-amber-400 rounded" />
          全体
        </div>
        {subjects.map((s) => {
          const active = activeSubjects.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleSubject(s)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                active
                  ? "border-transparent text-white"
                  : "border-white/20 text-white/40 hover:text-white/60"
              }`}
              style={active ? { backgroundColor: SUBJECT_COLORS[s], borderColor: SUBJECT_COLORS[s] } : {}}
            >
              {SUBJECT_SHORT[s] ?? s}
              {active && <span className="text-white/70 text-[9px]"> {history[history.length - 1].bySubject[s]}%</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
