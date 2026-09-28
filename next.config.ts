import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(process.env.VERCEL
    ? {}
    : {
        turbopack: {
          root: path.resolve(__dirname, ".."),
        },
      }),
  // The demo tab sits bottom-left; keep the dev indicator out of its way.
  devIndicators: { position: "bottom-right" },
  // PGlite loads its WASM and data files from its own package folder at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Files read with fs at runtime, which the tracer cannot see on its own.
  outputFileTracingIncludes: {
    "/**": [
      "./src/styles/innercircle-tokens.css",
      "./public/brand/logo.jpg",
      "./node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff",
      "./node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff",
      "./node_modules/@electric-sql/pglite/dist/*.wasm",
      "./node_modules/@electric-sql/pglite/dist/*.data",
    ],
  },
};

export default nextConfig;
