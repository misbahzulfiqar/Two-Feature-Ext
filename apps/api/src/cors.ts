import type { NextFunction, Request, Response } from "express";

function isAllowedOrigin(origin: string): boolean {
  return (
    origin.startsWith("chrome-extension://") ||
    origin.includes(".ebay.") ||
    origin.includes("://ebay.") ||
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1")
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
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-correlation-id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
}
