import type { NextConfig } from "next";
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: { cpus: 2 },
};
export default config;
