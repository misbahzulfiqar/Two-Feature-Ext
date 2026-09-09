export const FITMENT_LOG_PREFIX = "[SellSimilar][fitment]";

const PREFIX = FITMENT_LOG_PREFIX;

export function fitmentLine(message: string): void {
  console.info(`${PREFIX} ${message}`);
}

export function fitmentStoppedAt(stage: string): void {
  console.info(`${PREFIX} STOPPED at: ${stage}`);
}

export function fitmentContextLabel(): string {
  try {
    const name = window.name || "(none)";
    const top = window === window.top ? "parent" : "iframe";
    return `${top} name=${name}`;
  } catch {
    return "unknown";
  }
}

export function fitmentLog(stage: string, detail?: string): void {
  const extra = detail ? ` | ${detail}` : "";
  console.info(`${PREFIX} ${stage} | ${fitmentContextLabel()}${extra}`);
}

export function fitmentWarn(stage: string, detail?: string): void {
  const extra = detail ? ` | ${detail}` : "";
  console.info(`${PREFIX} ${stage} | ${fitmentContextLabel()}${extra}`);
}

export function iframeIdentity(iframe: HTMLIFrameElement, seq: number): string {
  return `#${seq} name=${iframe.name || "(none)"} src=${iframe.src || "(empty)"}`;
}
