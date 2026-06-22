import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Road to the Final — World Cup 2026 Knockout Explorer",
    short_name: "Road to the Final",
    description:
      "Pick any two of the 48 teams and see the live, simulated odds they meet on the road to the Final.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#05080f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
