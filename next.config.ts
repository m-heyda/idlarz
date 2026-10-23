import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // The repo may sit below another lockfile (e.g. a parent folder); pin the workspace root explicitly
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
