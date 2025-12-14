import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations for Azure App Services
  output: 'standalone', // Optimizes for containerized deployments
  poweredByHeader: false, // Security: remove X-Powered-By header
  
  // Environment variables that should be available on the client
  env: {
    // Add any public env vars here if needed
  },
};

export default nextConfig;
