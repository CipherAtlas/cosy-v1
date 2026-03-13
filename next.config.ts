import type { NextConfig } from "next";

const hasConfiguredBasePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined;
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const fallbackBasePath = process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}` : "";
const rawBasePath = hasConfiguredBasePath ? configuredBasePath : fallbackBasePath;
const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
  : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  ...(normalizedBasePath
    ? {
        basePath: normalizedBasePath,
        assetPrefix: `${normalizedBasePath}/`
      }
    : {})
};

export default nextConfig;
