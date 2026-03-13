const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
  : "";

export const withBasePath = (path: string) => {
  if (!normalizedBasePath || !path.startsWith("/")) {
    return path;
  }

  return `${normalizedBasePath}${path}`;
};
