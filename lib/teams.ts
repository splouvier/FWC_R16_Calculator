import teamsData from "@/data/teams.json";

export type TeamMeta = {
  group: string;
  flag: string;
  primary: string;
  secondary: string;
  rating: number;
};

// Strip the leading "_note" key; everything else is a team.
const raw = teamsData.teams as Record<string, TeamMeta>;

export const TEAMS: Record<string, TeamMeta> = raw;
export const TEAM_NAMES: string[] = Object.keys(raw).sort();

export const GROUPS: Record<string, string[]> = TEAM_NAMES.reduce(
  (acc, name) => {
    const g = raw[name].group;
    (acc[g] ||= []).push(name);
    return acc;
  },
  {} as Record<string, string[]>,
);

export const GROUP_LETTERS = Object.keys(GROUPS).sort();

export function meta(name: string): TeamMeta | undefined {
  return raw[name];
}

/** A readable accent: nudge near-white kits toward their secondary for contrast on dark. */
export function accentColor(name: string): string {
  const m = raw[name];
  if (!m) return "#8aa0c8";
  const hex = m.primary.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.8 ? m.secondary : m.primary;
}
