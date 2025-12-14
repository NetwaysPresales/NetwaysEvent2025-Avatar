import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations for Azure App Services
  output: 'standalone', // Optimizes for containerized deployments
  poweredByHeader: false, // Security: remove X-Powered-By header
  
  // Image configuration for Azure Blob Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        pathname: '/**',
      },
      // Allow specific storage account if needed (more restrictive)
      // Uncomment and replace with your storage account name:
      // {
      //   protocol: 'https',
      //   hostname: 'avatarsa.blob.core.windows.net',
      //   pathname: '/**',
      // },
    ],
  },
  
  // Environment variables that should be available on the client
  env: {
    // Add any public env vars here if needed
  },
};

export default nextConfig;
