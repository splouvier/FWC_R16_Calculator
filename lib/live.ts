import snapshot from "@/data/wc2026_snapshot.json";
import { TEAMS } from "./teams";

type Score = { ft?: number[]; et?: number[]; p?: number[]; pen?: number[]; ps?: number[] };
type Raw = { round?: string; team1: string; team2: string; group?: string; score?: Score };

const KO_ROUNDS = new Set([
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Match for third place",
  "Final",
]);

const decisive = (v?: number[]) => !!v && v.length === 2 && v[0] !== v[1];

function koWinner(t1: string, t2: string, s: Score): string | null {
  for (const k of ["pen", "p", "ps"] as const) {
    if (decisive(s[k])) return s[k]![0] > s[k]![1] ? t1 : t2;
  }
  if (decisive(s.et)) return s.et![0] > s.et![1] ? t1 : t2;
  if (decisive(s.ft)) return s.ft![0] > s.ft![1] ? t1 : t2;
  return null;
}

function scoreLabel(s: Score): string | null {
  if (!s.ft || s.ft.length !== 2) return null;
  let lab = s.et ? `${s.et[0]}–${s.et[1]} aet` : `${s.ft[0]}–${s.ft[1]}`;
  const pen = s.pen || s.p || s.ps;
  if (pen && pen.length === 2) lab += ` (${pen[0]}–${pen[1]} pens)`;
  return lab;
}

export type LiveMatch = {
  num: number;
  team1: string;
  team2: string;
  real1: boolean;
  real2: boolean;
  score: string | null;
  winner: string | null;
};

let cache: Record<number, LiveMatch> | null = null;

/** The actual knockout bracket from the data: real teams + results where played. */
export function liveBracket(): Record<number, LiveMatch> {
  if (cache) return cache;
  const raw = (snapshot as { matches: Raw[] }).matches ?? [];
  cache = {};
  raw.forEach((m, i) => {
    if (!m.round || !KO_ROUNDS.has(m.round)) return;
    const s = m.score || {};
    const real1 = !!TEAMS[m.team1];
    const real2 = !!TEAMS[m.team2];
    cache![i + 1] = {
      num: i + 1,
      team1: m.team1,
      team2: m.team2,
      real1,
      real2,
      score: scoreLabel(s),
      winner: real1 && real2 ? koWinner(m.team1, m.team2, s) : null,
    };
  });
  return cache;
}

export function anyLiveResults(): boolean {
  return Object.values(liveBracket()).some((m) => m.winner);
}
