import type { Metadata } from "next";
import App from "@/components/App";
import { TEAMS } from "@/lib/teams";

type SP = { [key: string]: string | string[] | undefined };

function clean(v: string | string[] | undefined, fallback: string): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && TEAMS[s] ? s : fallback;
}

// Per-matchup metadata so a shared link unfurls with the right teams + OG card.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const a = clean(sp.a, "Canada");
  const b = clean(sp.b, "Portugal");
  const title = `${a} vs ${b}? · Road to the Final`;
  const description = `The live, simulated odds that ${a} and ${b} meet in the FIFA World Cup 2026 knockout rounds — and exactly where it would happen.`;
  const og = `/og?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: og, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [og] },
  };
}

export default function Page() {
  return <App />;
}
