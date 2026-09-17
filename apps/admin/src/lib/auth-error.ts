export function authRequestError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message ?? "");
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return "Cannot reach the account server. Keep the API running on port 3001.";
    }
    if (isUnverifiedEmailError(error)) {
      return "Please verify your email. We sent a new link if this account exists.";
    }
    if (message) {
      return message;
    }
  }
  return fallback;
}

export function isUnverifiedEmailError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const record = error as { status?: number; code?: string; message?: string };
  const message = String(record.message ?? "");
  const code = String(record.code ?? "").toUpperCase();
  return code.includes("VERIF") || /verif(y|ication)/i.test(message);
}
