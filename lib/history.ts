import historyData from "@/data/history.json";
import type { HistorySnapshot } from "./types";

// Daily odds history, shipped statically (refreshed by the cron) rather than in
// every API response. Used for the per-team odds sparkline.
export const HISTORY: HistorySnapshot[] =
  (historyData as { snapshots?: HistorySnapshot[] }).snapshots ?? [];

/** A team's title-odds series over the recorded snapshots. */
export function titleSeries(team: string): number[] {
  return HISTORY.map((s) => s.teams[team]?.title).filter(
    (v): v is number => typeof v === "number",
  );
}
