"use client";

import { useEffect, useMemo, useState } from "react";
import { meta, GROUP_LETTERS, GROUPS } from "@/lib/teams";
import { scheduleByDate, matchInstant, prettySlot, type SMatch } from "@/lib/schedule";

type Filter = "all" | "group" | "ko";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "group", label: "Groups" },
  { key: "ko", label: "Knockouts" },
];

function fmtDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ScheduleView({ teamA, teamB }: { teamA: string; teamB: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [country, setCountry] = useState<string>("");
  const [showPast, setShowPast] = useState(false);
  const [today, setToday] = useState<string>("");
  useEffect(() => {
    // viewer's *local* calendar date (client-only, avoids SSR/tz mismatch)
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(local);
  }, []);

  const days = useMemo(() => scheduleByDate(), []);
  const involvesMine = (m: SMatch) =>
    [m.team1, m.team2].some((t) => t === teamA || t === teamB);

  const filtered = days
    .filter((d) => showPast || !today || d.date >= today)
    .map((d) => ({
      date: d.date,
      matches: d.matches.filter((m) => {
        if (filter === "group" && m.isKnockout) return false;
        if (filter === "ko" && !m.isKnockout) return false;
        if (country && m.team1 !== country && m.team2 !== country) return false;
        return true;
      }),
    }))
    .filter((d) => d.matches.length > 0);

  const count = filtered.reduce((n, d) => n + d.matches.length, 0);

  return (
    <div className="rise">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {/* type */}
        <div className="glass rounded-full p-1 flex gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`display text-xs rounded-full px-3 py-1.5 transition-colors ${
                filter === f.key
                  ? "text-ink bg-[color-mix(in_srgb,var(--accent-a)_30%,var(--panel))]"
                  : "text-faint hover:text-mute"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* country */}
        <label className="glass rounded-full pl-3 pr-2 py-1 flex items-center gap-1.5 text-xs cursor-pointer">
          <span className="eyebrow text-[9px] text-faint">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-transparent text-ink display text-xs outline-none cursor-pointer max-w-[8rem] truncate"
            aria-label="Filter by country"
          >
            <option value="" style={{ color: "#000" }}>
              All
            </option>
            {GROUP_LETTERS.map((g) => (
              <optgroup key={g} label={`Group ${g}`} style={{ color: "#000" }}>
                {GROUPS[g].map((name) => (
                  <option key={name} value={name} style={{ color: "#000" }}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* past toggle */}
        <button
          onClick={() => setShowPast((v) => !v)}
          aria-pressed={showPast}
          className={`display text-xs rounded-full px-3 py-1.5 transition-colors glass ${
            showPast ? "text-ink" : "text-faint hover:text-mute"
          }`}
        >
          {showPast ? "✓ Past results" : "Show past results"}
        </button>

        <span className="text-xs text-faint ml-auto">{count} matches</span>
      </div>
      <p className="text-[11px] text-faint mb-5">Kick-off times shown in your local time zone.</p>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-mute">
          No matches for this filter.
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((day) => {
            const isToday = day.date === today;
            const isPast = !!today && day.date < today;
            return (
              <div key={day.date}>
                <div
                  className="flex items-center gap-2 mb-2 sticky top-0 py-1 z-10"
                  style={{ background: "linear-gradient(180deg, var(--bg) 60%, transparent)" }}
                >
                  <span className={`display text-sm ${isToday ? "text-ink" : isPast ? "text-faint" : "text-mute"}`}>
                    {fmtDate(day.date)}
                  </span>
                  {isToday && (
                    <span
                      className="eyebrow text-[9px] px-2 py-0.5 rounded-full text-ink"
                      style={{ background: "var(--accent-a)" }}
                    >
                      Today
                    </span>
                  )}
                  <span className="flex-1 h-px bg-line" />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {day.matches.map((m, i) => (
                    <MatchRow key={i} m={m} mine={involvesMine(m)} dim={isPast} localize={!!today} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function MatchRow({
  m,
  mine,
  dim,
  localize,
}: {
  m: SMatch;
  mine: boolean;
  dim: boolean;
  localize: boolean;
}) {
  const center = (() => {
    if (m.score) return `${m.score[0]}–${m.score[1]}`;
    if (localize) {
      const inst = matchInstant(m);
      if (inst) return inst.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return m.time ? m.time.replace(/ UTC.*/, "") : "vs";
  })();

  return (
    <div
      className="card p-3 flex flex-col gap-1.5"
      style={mine ? { borderColor: "color-mix(in srgb, var(--accent-a) 50%, var(--line))" } : undefined}
    >
      <div className={`flex items-center gap-2 ${dim ? "opacity-60" : ""}`}>
        <Side name={m.team1} real={m.team1Real} />
        <span className="tnum text-sm font-semibold text-ink px-2 shrink-0 whitespace-nowrap">
          {center}
        </span>
        <Side name={m.team2} real={m.team2Real} right />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-faint">
        <span
          className="eyebrow text-[9px] px-1.5 py-0.5 rounded shrink-0"
          style={{ background: m.isKnockout ? "color-mix(in srgb, var(--accent-b) 25%, var(--panel))" : "var(--panel)" }}
        >
          {m.roundLabel}
        </span>
        <span className="truncate">{m.venue}</span>
        {m.score && (
          <span className="ml-auto eyebrow text-[8px] text-faint shrink-0">FT</span>
        )}
      </div>
    </div>
  );
}
