"use client";

import { useEffect, useMemo, useState } from "react";
import { meta } from "@/lib/teams";
import { scheduleByDate, prettySlot, type SMatch } from "@/lib/schedule";

type Filter = "all" | "group" | "ko" | "mine";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "group", label: "Groups" },
  { key: "ko", label: "Knockouts" },
  { key: "mine", label: "My two" },
];

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ScheduleView({ teamA, teamB }: { teamA: string; teamB: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    // client-only: avoids SSR/client date mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const days = useMemo(() => scheduleByDate(), []);
  const involvesMine = (m: SMatch) =>
    [m.team1, m.team2].some((t) => t === teamA || t === teamB);

  const filtered = days
    .map((d) => ({
      date: d.date,
      matches: d.matches.filter((m) =>
        filter === "all"
          ? true
          : filter === "group"
            ? !m.isKnockout
            : filter === "ko"
              ? m.isKnockout
              : involvesMine(m),
      ),
    }))
    .filter((d) => d.matches.length > 0);

  return (
    <div className="rise">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="glass rounded-full p-1 flex gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`display text-xs rounded-full px-3 py-1.5 transition-colors ${
                filter === f.key ? "text-ink bg-[color-mix(in_srgb,var(--accent-a)_30%,var(--panel))]" : "text-faint hover:text-mute"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-faint">{filtered.reduce((n, d) => n + d.matches.length, 0)} matches</span>
      </div>

      <div className="space-y-6">
        {filtered.map((day) => {
          const isToday = day.date === today;
          const isPast = today && day.date < today;
          return (
            <div key={day.date}>
              <div className="flex items-center gap-2 mb-2 sticky top-0 py-1 z-10" style={{ background: "linear-gradient(180deg, var(--bg) 60%, transparent)" }}>
                <span className={`display text-sm ${isToday ? "text-ink" : "text-mute"}`}>
                  {fmtDate(day.date)}
                </span>
                {isToday && (
                  <span className="eyebrow text-[9px] px-2 py-0.5 rounded-full text-ink" style={{ background: "var(--accent-a)" }}>
                    Today
                  </span>
                )}
                <span className="flex-1 h-px bg-line" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {day.matches.map((m, i) => (
                  <MatchRow key={i} m={m} mine={involvesMine(m)} dim={!!isPast && !m.score} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Side({ name, real, right }: { name: string; real: boolean; right?: boolean }) {
  const m = real ? meta(name) : undefined;
  return (
    <div className={`flex items-center gap-2 min-w-0 flex-1 ${right ? "flex-row-reverse text-right" : ""}`}>
      <span className="text-lg shrink-0">{m?.flag ?? "•"}</span>
      <span className={`truncate text-sm ${real ? "text-ink" : "text-faint italic"}`}>
        {real ? name : prettySlot(name)}
      </span>
    </div>
  );
}

function MatchRow({ m, mine, dim }: { m: SMatch; mine: boolean; dim: boolean }) {
  return (
    <div
      className="card p-3 flex flex-col gap-1.5"
      style={mine ? { borderColor: "color-mix(in srgb, var(--accent-a) 50%, var(--line))" } : undefined}
    >
      <div className={`flex items-center gap-2 ${dim ? "opacity-50" : ""}`}>
        <Side name={m.team1} real={m.team1Real} />
        <span className="tnum text-sm font-semibold text-ink px-2 shrink-0">
          {m.score ? `${m.score[0]}–${m.score[1]}` : m.time ? m.time.replace(/ UTC.*/, "") : "vs"}
        </span>
        <Side name={m.team2} real={m.team2Real} right />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span
          className="eyebrow text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: m.isKnockout ? "color-mix(in srgb, var(--accent-b) 25%, var(--panel))" : "var(--panel)" }}
        >
          {m.roundLabel}
        </span>
        <span className="truncate">{m.venue}</span>
      </div>
    </div>
  );
}
