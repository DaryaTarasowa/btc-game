export function toEpochMilliseconds(timestamp: string): number {
  const milliseconds = Date.parse(timestamp);

  if (Number.isNaN(milliseconds)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return milliseconds;
}

export type LogLevel = "info" | "warn" | "error";

export function log(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {},
): void {
  const entry = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}
