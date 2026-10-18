import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@tensorflow/tfjs-core",
    "@tensorflow/tfjs-converter",
    "@tensorflow/tfjs-backend-cpu",
  ],
  outputFileTracingIncludes: {
    "/api/groups": ["./src/modules/sessions/infrastructure/face-model/**/*"],
    "/api/sessions/*/join": [
      "./src/modules/sessions/infrastructure/face-model/**/*",
    ],
    "/api/selfies/validate": [
      "./src/modules/sessions/infrastructure/face-model/**/*",
    ],
  },
  async headers() {
    return [
      {
        // Browsers must always fetch the latest worker, and it may only run our code.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
