import { randomUUID } from "node:crypto";
import pino, { type Logger, type LoggerOptions } from "pino";

export const CORRELATION_ID_HEADER = "x-correlation-id";

export type AppLogger = Logger;

export type CreateLoggerOptions = {
  name: string;
  level?: string;
  pretty?: boolean;
};

export function resolveCorrelationId(
  headerValue: string | undefined,
): string {
  const trimmed = headerValue?.trim();
  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }
  return randomUUID();
}

export function createLogger(options: CreateLoggerOptions): AppLogger {
  const pretty =
    options.pretty ?? process.env.NODE_ENV !== "production";
  const loggerOptions: LoggerOptions = {
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
  };

  if (pretty) {
    return pino({
      ...loggerOptions,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    });
  }

  return pino(loggerOptions);
}

export function withCorrelationId(
  logger: AppLogger,
  correlationId: string,
): AppLogger {
  return logger.child({ correlationId });
}
