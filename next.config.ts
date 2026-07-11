import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The corridor pages and /api/vfs read data/vfs/*.json with readFileSync at
  // request time (ISR fills non-prewarmed corridors on demand). Pin the files
  // into the serverless bundles explicitly - today they ride along only via
  // @vercel/nft's wildcard analysis of join(process.cwd(), "data", ...), which
  // any refactor of that path expression could silently break.
  outputFileTracingIncludes: {
    "/passport/[slug]/[dest]": ["./data/vfs/**"],
    "/api/vfs": ["./data/vfs/**"],
  },
  async rewrites() {
    return [
      // Vanity Earthling profiles: earthvisa.in/@aditya -> /earthling/aditya
      { source: "/@:username", destination: "/earthling/:username" },
    ];
  },
};

export default nextConfig;
