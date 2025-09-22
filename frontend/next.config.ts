import type { NextConfig } from "next";

// Pin Turbopack's root to this app to avoid multi-lockfile root inference issues
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
