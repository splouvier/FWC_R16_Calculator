import snapshot from "@/data/wc2026_snapshot.json";
import { TEAMS } from "./teams";

export type SMatch = {
  date: string;
  time: string;
  roundLabel: string; // "Group B" or "Round of 16" etc.
  isKnockout: boolean;
  venue: string;
  team1: string;
  team2: string;
  team1Real: boolean; // true if a resolved team (has flag), false if a slot placeholder
  team2Real: boolean;
  score: [number, number] | null;
};

type RawMatch = {
  round?: string;
  date?: string;
  time?: string;
  team1: string;
  team2: string;
  group?: string;
  ground?: string;
  score?: { ft?: number[] };
};

const KO_ROUNDS = new Set([
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Match for third place",
  "Final",
]);

/** Make slot codes human-readable: 1B -> "Winner B", 2C -> "Runner-up C", etc. */
export function prettySlot(code: string): string {
  if (TEAMS[code]) return code;
  let m = code.match(/^1([A-L])$/);
  if (m) return `Winner ${m[1]}`;
  m = code.match(/^2([A-L])$/);
  if (m) return `Runner-up ${m[1]}`;
  if (/^3[A-L/]+$/.test(code)) return "3rd place";
  m = code.match(/^W(\d+)$/);
  if (m) return `Winner of M${m[1]}`;
  m = code.match(/^L(\d+)$/);
  if (m) return `Loser of M${m[1]}`;
  return code;
}

let cached: SMatch[] | null = null;

export function getSchedule(): SMatch[] {
  if (cached) return cached;
  const raw = (snapshot as { matches: RawMatch[] }).matches ?? [];
  cached = raw
    .map((m): SMatch => {
      const isKo = !!m.round && KO_ROUNDS.has(m.round);
      const roundLabel = m.group
        ? m.group
        : m.round === "Match for third place"
          ? "3rd-place play-off"
          : m.round ?? "";
      const ft = m.score?.ft;
      return {
        date: m.date ?? "",
        time: m.time ?? "",
        roundLabel,
        isKnockout: isKo,
        venue: m.ground ?? "",
        team1: m.team1,
        team2: m.team2,
        team1Real: !!TEAMS[m.team1],
        team2Real: !!TEAMS[m.team2],
        score: ft && ft.length === 2 ? [ft[0], ft[1]] : null,
      };
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return cached;
}

/** Group matches by calendar date, preserving chronological order. */
export function scheduleByDate(): { date: string; matches: SMatch[] }[] {
  const out: { date: string; matches: SMatch[] }[] = [];
  for (const m of getSchedule()) {
    let bucket = out[out.length - 1];
    if (!bucket || bucket.date !== m.date) {
      bucket = { date: m.date, matches: [] };
      out.push(bucket);
    }
    bucket.matches.push(m);
  }
  return out;
}
