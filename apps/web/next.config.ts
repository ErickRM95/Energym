import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  cacheComponents: true,
  transpilePackages: ["@energym/shared"],
  partialPrefetching: true,
  async rewrites() {
    return {
      fallback: [
        { source: "/movil", destination: "/movil/index.html" },
        { source: "/movil/:path*", destination: "/movil/index.html" },
      ],
    };
  },
  turbopack: {
    root: path.resolve(appDir, "../.."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
