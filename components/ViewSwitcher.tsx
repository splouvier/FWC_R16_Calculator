"use client";

export type ViewKey =
  | "simulate"
  | "bracket"
  | "leaders"
  | "schedule"
  | "standings"
  | "about";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "simulate", label: "Simulate" },
  { key: "bracket", label: "Bracket" },
  { key: "leaders", label: "Leaders" },
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings" },
  { key: "about", label: "Method" },
];

export default function ViewSwitcher({
  view,
  onChange,
}: {
  view: ViewKey;
  onChange: (v: ViewKey) => void;
}) {
  return (
    <div
      className="glass rounded-full p-1 flex w-full max-w-3xl mx-auto gap-0.5 overflow-x-auto no-scrollbar"
      role="tablist"
    >
      {VIEWS.map((v) => {
        const active = v.key === view;
        return (
          <button
            key={v.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.key)}
            className={`flex-1 min-w-0 truncate display text-[10px] sm:text-sm rounded-full py-2 px-1 sm:px-2 tracking-tight sm:tracking-normal whitespace-nowrap transition-all ${
              active ? "text-ink" : "text-faint hover:text-mute"
            }`}
            style={
              active
                ? {
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--accent-a) 35%, var(--panel)), color-mix(in srgb, var(--accent-b) 35%, var(--panel-2)))",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.15)",
                  }
                : undefined
            }
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
