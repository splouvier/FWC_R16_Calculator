import type { Scenario, SimResponse, SensitivityResponse } from "./types";

/**
 * Call the simulation API. Uses GET (cacheable) when there is no scenario,
 * POST when the user has forced results.
 */
export async function simulate(
  a: string,
  b: string,
  scenario?: Scenario | null,
  signal?: AbortSignal,
): Promise<SimResponse> {
  const hasScenario = !!scenario && scenario.forced.length > 0;
  let res: Response;
  if (hasScenario) {
    res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a, b, scenario }),
      signal,
    });
  } else {
    const qs = new URLSearchParams({ a, b });
    res = await fetch(`/api/simulate?${qs.toString()}`, { signal });
  }
  if (!res.ok) throw new Error(`Simulation failed (${res.status})`);
  return res.json();
}

/** Rank upcoming games by how much they swing the dream meeting probability. */
export async function fetchSensitivity(
  a: string,
  b: string,
  signal?: AbortSignal,
): Promise<SensitivityResponse> {
  const res = await fetch("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ a, b, sensitivity: true }),
    signal,
  });
  if (!res.ok) throw new Error(`Sensitivity failed (${res.status})`);
  return res.json();
}

export function pct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}
