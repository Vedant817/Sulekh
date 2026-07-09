import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack does not warn about multiple lockfiles
  // detected higher up the filesystem.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
