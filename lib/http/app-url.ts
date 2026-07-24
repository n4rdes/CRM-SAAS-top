export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new Error("NEXT_PUBLIC_APP_URL_NOT_CONFIGURED");
    return "http://localhost:3000";
  }

  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("INVALID_APP_URL_PROTOCOL");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL_MUST_USE_HTTPS");
  return url.origin;
}
