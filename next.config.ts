import type { NextConfig } from "next";
import { canonicalRedirects } from "./src/lib/canonical-host";

const nextConfig: NextConfig = {
  cacheComponents: true,
  async redirects() {
    return canonicalRedirects(process.env);
  },
};

export default nextConfig;
