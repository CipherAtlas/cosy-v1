import type { NextConfig } from "next";

const hasConfiguredBasePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined;
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const fallbackBasePath = process.env.GITHUB_ACTIONS === "true" && repoName ? `/${repoName}` : "";
const rawBasePath = hasConfiguredBasePath ? configuredBasePath : fallbackBasePath;
const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
  : "";
const allowedDevOrigins = (process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  experimental: {
    devtoolSegmentExplorer: false
  },
  images: {
    unoptimized: true
  },
  ...(allowedDevOrigins.length > 0
    ? {
        allowedDevOrigins
      }
    : {}),
  ...(normalizedBasePath
    ? {
        basePath: normalizedBasePath,
        assetPrefix: `${normalizedBasePath}/`
      }
    : {})
};

export default nextConfig;
