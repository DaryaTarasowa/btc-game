export function toEpochMilliseconds(timestamp: string): number {
  const milliseconds = Date.parse(timestamp);

  if (Number.isNaN(milliseconds)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return milliseconds;
}

export function toEpochNanoseconds(timestamp: string): bigint {
  const match = timestamp.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/,
  );

  if (!match) {
    throw new Error(`Invalid UTC timestamp: ${timestamp}`);
  }

  const [, secondsPart, fractionalPart = ""] = match;

  const epochMilliseconds = Date.parse(`${secondsPart}Z`);
  if (Number.isNaN(epochMilliseconds)) {
    throw new Error(`Invalid UTC timestamp: ${timestamp}`);
  }

  const epochSeconds = BigInt(epochMilliseconds / 1000);

  const nanoseconds = BigInt(fractionalPart.padEnd(9, "0"));

  return epochSeconds * 1_000_000_000n + nanoseconds;
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
