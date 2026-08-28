import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@sell-similar/logging";
import type { NextFunction, Request, Response } from "express";

export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const correlationId = resolveCorrelationId(
    req.header(CORRELATION_ID_HEADER),
  );
  req.correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
