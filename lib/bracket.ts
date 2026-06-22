import bracketData from "@/data/bracket.json";
import { GROUPS, TEAM_NAMES, effectiveRating } from "./teams";
import type { TeamStats } from "./types";

export type Slot =
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
export const matchByNum = (num: number) => BY_NUM.get(num);
export const feedsInto = (num: number) => PARENT.get(num);
export const FINAL_NUM = KO.find((m) => m.round === "F")?.num ?? 104;
export const KO_ROUNDS = ["R32", "R16", "QF", "SF", "F"] as const;

export type Seed = Record<number, { home: string; away: string }>;

/**
 * Project the 32-team Round of 32 field from the model: each group's most likely
 * winner / runner-up / qualifying third, with best thirds greedily slotted into
 * the third-place slots. A starting point the user can freely edit.
 */
export function seedR32(teams: Record<string, TeamStats>): Seed {
  const first: Record<string, string> = {};
  const second: Record<string, string> = {};
  const third: Record<string, string> = {};
  for (const g of Object.keys(GROUPS)) {
    const members = GROUPS[g].filter((n) => teams[n]);
    if (members.length < 3) continue;
    first[g] = [...members].sort((a, b) => teams[b].groupWin - teams[a].groupWin)[0];
    second[g] = members
      .filter((n) => n !== first[g])
      .sort((a, b) => teams[b].runnerUp - teams[a].runnerUp)[0];
    third[g] = members
      .filter((n) => n !== first[g] && n !== second[g])
      .sort((a, b) => teams[b].reachR32 - teams[a].reachR32)[0];
  }
  const usedThird = new Set<string>();
  const pickThird = (groups: string[]) => {
    const cand = groups
      .map((g) => third[g])
      .filter((n) => n && !usedThird.has(n))
      .sort((a, b) => teams[b].reachR32 - teams[a].reachR32)[0];
    if (cand) usedThird.add(cand);
    return cand;
  };
  const resolve = (s: Slot): string => {
    if (s.type === "group_1st") return first[s.group] ?? `Winner ${s.group}`;
    if (s.type === "group_2nd") return second[s.group] ?? `Runner-up ${s.group}`;
    if (s.type === "group_3rd") return pickThird(s.groups) ?? "3rd place";
    return "";
  };
  const seed: Seed = {};
  for (const m of KO) {
    if (m.round === "R32") seed[m.num] = { home: resolve(m.home), away: resolve(m.away) };
  }
  return seed;
}

/** The model's "chalk" bracket: advance the higher-rated team in every tie. */
export function modelPicks(seed: Seed): Record<number, string> {
  const picks: Record<number, string> = {};
  const part = (m: KMatch, side: "home" | "away"): string | undefined => {
    const f = m[side];
    if (f.type === "winner_of") return picks[f.match];
    return seed[m.num]?.[side];
  };
  for (const m of KO) {
    if (m.round === "3P") continue;
    const h = part(m, "home");
    const a = part(m, "away");
    if (!h || !a) continue;
    picks[m.num] = effectiveRating(h) >= effectiveRating(a) ? h : a;
  }
  return picks;
}

/** Compact, shareable encoding of a set of bracket picks: "num.teamIdx-num.teamIdx". */
export function encodePicks(picks: Record<number, string>): string {
  return Object.entries(picks)
    .map(([num, name]) => [num, TEAM_NAMES.indexOf(name)] as const)
    .filter(([, idx]) => idx >= 0)
    .map(([num, idx]) => `${num}.${idx}`)
    .join("-");
}

export function decodePicks(str: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const part of str.split("-")) {
    const [n, i] = part.split(".");
    const num = parseInt(n, 10);
    const name = TEAM_NAMES[parseInt(i, 10)];
    if (!Number.isNaN(num) && name) out[num] = name;
  }
  return out;
}
