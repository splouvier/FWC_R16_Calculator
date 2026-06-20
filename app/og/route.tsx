import { ImageResponse } from "next/og";
import { TEAMS, accentColor } from "@/lib/teams";

export const runtime = "edge";

// Dynamic social card for a matchup: /og?a=Canada&b=Portugal
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const a = pick(searchParams.get("a"), "Canada");
  const b = pick(searchParams.get("b"), "Portugal");
  const ca = accentColor(a);
  const cb = accentColor(b);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#060912",
          backgroundImage: `radial-gradient(900px 600px at 0% 0%, ${ca}40, transparent 55%), radial-gradient(900px 600px at 100% 100%, ${cb}40, transparent 55%)`,
          color: "#f2f6ff",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 6,
            color: "#97a6c2",
            fontWeight: 700,
          }}
        >
          FIFA WORLD CUP 2026 · KNOCKOUT EXPLORER
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <TeamName name={a} color={ca} />
            <span style={{ display: "flex", fontSize: 44, color: "#5e6e8f", fontWeight: 700 }}>
              vs
            </span>
            <TeamName name={b} color={cb} />
          </div>
          <div style={{ display: "flex", fontSize: 40, color: "#c4d2dd", fontWeight: 600 }}>
            Will they meet on the Road to the Final?
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#8a99a6" }}>
            fwc-r16-calculator.vercel.app
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ display: "flex", width: 60, height: 12, borderRadius: 6, backgroundColor: ca }} />
            <span style={{ display: "flex", width: 60, height: 12, borderRadius: 6, backgroundColor: cb }} />
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

function TeamName({ name, color }: { name: string; color: string }) {
  const size = name.length > 13 ? 64 : name.length > 9 ? 84 : 104;
  return (
    <span
      style={{
        display: "flex",
        fontSize: size,
        fontWeight: 800,
        color,
        lineHeight: 1,
        textShadow: `0 0 40px ${color}66`,
      }}
    >
      {name}
    </span>
  );
}

function pick(v: string | null, fallback: string): string {
  return v && TEAMS[v] ? v : fallback;
}
