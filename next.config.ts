import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // In local dev, Next doesn't run the Python serverless function, so proxy
    // /api/simulate to the standalone dev server (scripts/dev_api.py on :8000).
    // In production on Vercel, no rewrite — Vercel serves api/simulate.py directly.
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
