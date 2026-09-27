import type { NextFunction, Request, Response } from "express";

const PRODUCTION_WEB_ORIGINS = [
  "https://two-feature-ext-web.vercel.app",
  "https://two-feature-ext-admin.vercel.app",
  "https://two-feature-ext-api-jfyp.vercel.app",
];

function isAllowedOrigin(origin: string): boolean {
  return (
    origin.startsWith("chrome-extension://") ||
    origin.includes(".ebay.") ||
    origin.includes("://ebay.") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    PRODUCTION_WEB_ORIGINS.includes(origin)
  );
}

export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.header("origin") ?? "";
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  const requestedHeaders = req.header("access-control-request-headers");
  res.setHeader(
    "Access-Control-Allow-Headers",
    requestedHeaders ||
      "content-type, x-correlation-id, authorization, cookie, x-extension-user-id",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
