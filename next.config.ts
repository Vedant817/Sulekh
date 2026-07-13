import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not warn about multiple lockfiles
  // detected higher up the filesystem.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Source documents are validated to 25 MB per request before persistence.
    // Leave room for multipart boundaries above that application-level cap.
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
