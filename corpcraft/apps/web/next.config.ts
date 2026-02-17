import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@corpcraft/contracts"],
  // IMPORTANT: reactStrictMode MUST be false for React Three Fiber.
  // StrictMode double-renders components in dev, causing WebGL context
  // conflicts, duplicate Canvas initialisations, and visible flickering.
  reactStrictMode: false,
};

export default nextConfig;
