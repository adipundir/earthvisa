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
  async headers() {
    return [
      {
        // The manifest is the ONLY mutable URL in the mobile data channel, so it
        // is the only one that must not be cached hard. Five minutes keeps a
        // data correction propagating quickly without making every app launch
        // an origin hit.
        source: "/mobile/manifest.json",
        headers: [
          { key: "cache-control", value: "public, max-age=300, must-revalidate" },
          { key: "content-type", value: "application/json; charset=utf-8" },
        ],
      },
      {
        // Every bundle filename contains a hash of its own content, so a given
        // URL can never change meaning and can be cached forever.
        source: "/mobile/:version/:file*",
        headers: [
          { key: "cache-control", value: "public, max-age=31536000, immutable" },
          // These files ARE brotli, they are not brotli-encoded JSON. Serving
          // them as octet-stream stops a CDN or proxy inferring
          // "Content-Encoding: br" from the extension, which would make
          // URLSession transparently inflate them. The app hashes the bytes it
          // downloads against the manifest, so a transparently decompressed
          // response would fail integrity and reject every valid update.
          { key: "content-type", value: "application/octet-stream" },
        ],
      },
    ];
  },
};

export default nextConfig;
