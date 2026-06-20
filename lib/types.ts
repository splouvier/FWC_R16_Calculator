export type TeamStats = {
  title: number;
  reachR16: number;
  reachR32: number;
  groupWin: number;
  expRound: number;
};

export type RoundMeeting = {
  prob: number;
  venues: Record<string, number>;
};

export type PairResult = {
  a: string;
  b: string;
  meet: number;
  byRound: Record<string, RoundMeeting>;
};

export type Standing = { pts: number; gf: number; ga: number; gd: number };

export type Fixture = { group: string; home: string; away: string };

export type SimResponse = {
  meta: {
    nSims: number;
    source: "live" | "snapshot";
    asOf: string | null;
    cached?: boolean;
  };
  teams: Record<string, TeamStats>;
  pair?: PairResult;
  standings: Record<string, Standing>;
  upcoming: Fixture[];
};

export type ForcedResult = { home: string; away: string; winner: string };
export type Scenario = { forced: ForcedResult[] };

// Display order + labels for knockout rounds.
export const ROUND_ORDER = ["R32", "R16", "QF", "SF", "F"] as const;
export const ROUND_LABEL: Record<string, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-final",
  SF: "Semi-final",
  F: "Final",
};
export const ROUND_SHORT: Record<string, string> = {
  R32: "R32",
  R16: "R16",
  QF: "QF",
  SF: "SF",
  F: "Final",
};
