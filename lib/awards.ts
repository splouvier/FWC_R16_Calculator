import snapshot from "@/data/wc2026_snapshot.json";
import { TEAMS } from "./teams";

type RawGoal = { name?: string; minute?: string; owngoal?: boolean; penalty?: boolean };
type RawMatch = {
  team1: string;
  team2: string;
  goals1?: RawGoal[];
  goals2?: RawGoal[];
  score?: { ft?: number[] };
};

export type Scorer = { name: string; team: string; goals: number; pens: number };
export type TeamStat = { team: string; value: number; games: number };

export type Awards = {
  scorers: Scorer[];
  teamGoals: TeamStat[];
  teamDefense: TeamStat[];
  totalGoals: number;
  matchesPlayed: number;
};

let cached: Awards | null = null;

export function getAwards(): Awards {
  if (cached) return cached;
  const matches = (snapshot as { matches: RawMatch[] }).matches ?? [];

  const scorers = new Map<string, Scorer>();
  const gf = new Map<string, number>();
  const ga = new Map<string, number>();
  const games = new Map<string, number>();
  let totalGoals = 0;
  let matchesPlayed = 0;

  const credit = (goals: RawGoal[] | undefined, team: string) => {
    for (const g of goals ?? []) {
      if (!g.name || g.owngoal) continue; // own goals don't count toward the boot
      const cur = scorers.get(g.name) ?? { name: g.name, team, goals: 0, pens: 0 };
      cur.goals += 1;
      if (g.penalty) cur.pens += 1;
      cur.team = team;
      scorers.set(g.name, cur);
      totalGoals += 1;
    }
  };

  for (const m of matches) {
    const ft = m.score?.ft;
    if (!ft || ft.length !== 2) continue;
    matchesPlayed += 1;
    if (TEAMS[m.team1]) {
      gf.set(m.team1, (gf.get(m.team1) ?? 0) + ft[0]);
      ga.set(m.team1, (ga.get(m.team1) ?? 0) + ft[1]);
      games.set(m.team1, (games.get(m.team1) ?? 0) + 1);
    }
    if (TEAMS[m.team2]) {
      gf.set(m.team2, (gf.get(m.team2) ?? 0) + ft[1]);
      ga.set(m.team2, (ga.get(m.team2) ?? 0) + ft[0]);
      games.set(m.team2, (games.get(m.team2) ?? 0) + 1);
    }
    if (TEAMS[m.team1]) credit(m.goals1, m.team1);
    if (TEAMS[m.team2]) credit(m.goals2, m.team2);
  }

  const teamStat = (src: Map<string, number>): TeamStat[] =>
    [...src.entries()].map(([team, value]) => ({ team, value, games: games.get(team) ?? 0 }));

  cached = {
    scorers: [...scorers.values()].sort(
      (a, b) => b.goals - a.goals || a.name.localeCompare(b.name),
    ),
    teamGoals: teamStat(gf).sort((a, b) => b.value - a.value),
    teamDefense: teamStat(ga).sort((a, b) => a.value - b.value), // fewest conceded first
    totalGoals,
    matchesPlayed,
  };
  return cached;
}
