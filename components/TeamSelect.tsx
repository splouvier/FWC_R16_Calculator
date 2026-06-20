"use client";

import { GROUP_LETTERS, GROUPS, meta } from "@/lib/teams";

/** Native select grouped by group letter, styled to match the dark theme. */
export default function TeamSelect({
  value,
  onChange,
  accent,
  exclude,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: string;
  exclude?: string;
}) {
  const m = meta(value);
  return (
    <label
      className="card flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
      style={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}33, 0 8px 30px -12px ${accent}66` }}
    >
      <span className="text-3xl leading-none select-none" aria-hidden>
        {m?.flag ?? "🏳️"}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] eyebrow text-faint">Team</span>
        <span className="relative block">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="display w-full bg-transparent text-ink text-lg sm:text-xl outline-none cursor-pointer pr-5 truncate"
          >
            {GROUP_LETTERS.map((g) => (
              <optgroup key={g} label={`Group ${g}`} style={{ color: "#000" }}>
                {GROUPS[g].map((name) => (
                  <option
                    key={name}
                    value={name}
                    disabled={name === exclude}
                    style={{ color: "#000" }}
                  >
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          >
            ▾
          </span>
        </span>
      </span>
    </label>
  );
}
