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
