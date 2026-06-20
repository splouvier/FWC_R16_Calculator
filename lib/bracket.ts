import bracketData from "@/data/bracket.json";
import type { TeamStats } from "./types";

type Slot =
  | { type: "group_1st"; group: string }
  | { type: "group_2nd"; group: string }
  | { type: "group_3rd"; groups: string[] }
  | { type: "winner_of"; match: number }
  | { type: "loser_of"; match: number };

export type KMatch = {
  num: number;
  round: string;
  round_label: string;
  date: string;
  venue: string;
  home: Slot;
  away: Slot;
};

const KO: KMatch[] = bracketData.knockout as KMatch[];
const BY_NUM = new Map(KO.map((m) => [m.num, m]));

// child match num -> the match it feeds into
const PARENT = new Map<number, number>();
for (const m of KO) {
  for (const slot of [m.home, m.away]) {
    if (slot.type === "winner_of") PARENT.set(slot.match, m.num);
  }
}

export const ROUND_INDEX: Record<string, number> = {
  R32: 0,
  R16: 1,
  QF: 2,
  SF: 3,
  F: 4,
};

type Kind = "group_1st" | "group_2nd";

function entryMatch(kind: Kind, group: string): KMatch | undefined {
  return KO.find(
    (m) =>
      m.round === "R32" &&
      [m.home, m.away].some(
        (s) => (s.type === kind && (s as { group: string }).group === group),
      ),
  );
}

/** The chain of matches from a team's R32 entry (as 1st or 2nd) to the Final. */
function tracePathKind(group: string, kind: Kind): KMatch[] {
  const start = entryMatch(kind, group);
  const matches: KMatch[] = [];
  let cur = start?.num;
  while (cur != null) {
    const m = BY_NUM.get(cur);
    if (!m) break;
    matches.push(m);
    cur = PARENT.get(cur);
  }
  return matches;
}

/** The first match (lowest round) the two paths share — where they'd meet. */
export function convergenceMatch(a: KMatch[], b: KMatch[]): KMatch | null {
  const bNums = new Set(b.map((m) => m.num));
  for (const m of a) if (bNums.has(m.num)) return m;
  return null;
}

const conf = (stats: TeamStats | undefined, kind: Kind) =>
  kind === "group_1st" ? stats?.groupWin ?? 0 : stats?.runnerUp ?? 0;

export type PathPlan = {
  entryA: { kind: Kind; label: string; conf: number };
  entryB: { kind: Kind; label: string; conf: number };
  pathA: KMatch[];
  pathB: KMatch[];
  conv: KMatch | null;
};

/**
 * Choose the pair of group-finish positions (1st/2nd each) whose bracket paths
 * converge at `targetRound` — i.e. the scenario that actually produces their
 * most-likely meeting. Falls back to the highest-combined-probability combo.
 */
export function planPaths(
  groupA: string,
  statsA: TeamStats | undefined,
  groupB: string,
  statsB: TeamStats | undefined,
  targetRound: string | null,
): PathPlan {
  const kinds: Kind[] = ["group_1st", "group_2nd"];
  let best: PathPlan | null = null;
  let bestScore = -1;
  for (const ka of kinds) {
    for (const kb of kinds) {
      const pathA = tracePathKind(groupA, ka);
      const pathB = tracePathKind(groupB, kb);
      const conv = convergenceMatch(pathA, pathB);
      const matchesTarget = targetRound && conv?.round === targetRound ? 1 : 0;
      // prefer the combo that hits the target round, then higher joint likelihood
      const score = matchesTarget * 10 + conf(statsA, ka) * conf(statsB, kb);
      if (score > bestScore) {
        bestScore = score;
        best = {
          entryA: { kind: ka, label: `${ka === "group_1st" ? 1 : 2}${groupA}`, conf: conf(statsA, ka) },
          entryB: { kind: kb, label: `${kb === "group_1st" ? 1 : 2}${groupB}`, conf: conf(statsB, kb) },
          pathA,
          pathB,
          conv,
        };
      }
    }
  }
  return best as PathPlan;
}

export { KO };
