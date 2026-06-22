export type ReachByRound = {
  R32: number;
  R16: number;
  QF: number;
  SF: number;
  F: number;
  champion: number;
};

export type TeamStats = {
  title: number;
  reachR16: number;
  reachR32: number;
  groupWin: number;
  runnerUp: number;
  expRound: number;
  reachByRound: ReachByRound;
};

export type MeetingMatch = {
  num: number;
  venue: string;
  date: string | null;
  prob: number;
};

export type RoundMeeting = {
  prob: number;
  matches: MeetingMatch[];
};

export type PairResult = {
  a: string;
  b: string;
  meet: number;
  meetCI: number;
  byRound: Record<string, RoundMeeting>;
  aWinIfMeet: number | null;
};

export type Trend = { title: number; groupWin: number; reachR16: number };

export type CalibrationBucket = { predicted: number; actual: number; n: number };
export type Calibration = {
  n: number;
  accuracy?: number;
  brier?: number;
  favWinRate?: number | null;
  buckets?: CalibrationBucket[];
};

export type HistorySnapshot = {
  date: string;
  asOf: string | null;
  teams: Record<string, { title: number; groupWin: number; reachR16: number }>;
};

export type BoardEntry = { a: string; b: string; prob: number };
export type Boards = { finals: BoardEntry[]; meetAnywhere: BoardEntry[] };

export type Standing = { pts: number; gf: number; ga: number; gd: number };

export type Fixture = { group: string; home: string; away: string };

export type SimResponse = {
  meta: {
    nSims: number;
    source: "live" | "snapshot";
    asOf: string | null;
    cached?: boolean;
    trendSince?: string;
  };
  teams: Record<string, TeamStats>;
  pair?: PairResult;
  boards: Boards;
  standings: Record<string, Standing>;
  upcoming: Fixture[];
  trends?: Record<string, Trend>;
  calibration?: Calibration;
};

export type ForcedResult = { home: string; away: string; winner: string };
export type Scenario = { forced: ForcedResult[] };

export type SensOutcome = { winner: string; meet: number };
export type SensGame = {
  group: string;
  home: string;
  away: string;
  outcomes: SensOutcome[];
  swing: number;
};
export type SensitivityResponse = {
  a: string;
  b: string;
  base: number | null;
  sensitivity: SensGame[];
  meta: { nSims: number; source: string; asOf: string | null };
};

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
