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

export function queryTimestamp(date: Date): string {
  return date.toISOString().replace("Z", "000000Z");
}

function normalizedDecimal(value: string): {
  whole: string;
  fraction: string;
} {
  const [wholePart = "0", fractionPart = ""] = value.split(".");
  return {
    whole: wholePart.replace(/^0+(?=\d)/, ""),
    fraction: fractionPart.replace(/0+$/, ""),
  };
}

export function compareDecimal(left: string, right: string): number {
  const a = normalizedDecimal(left);
  const b = normalizedDecimal(right);
  if (a.whole.length !== b.whole.length)
    return a.whole.length > b.whole.length ? 1 : -1;
  if (a.whole !== b.whole) return a.whole > b.whole ? 1 : -1;
  const width = Math.max(a.fraction.length, b.fraction.length);
  const aFraction = a.fraction.padEnd(width, "0");
  const bFraction = b.fraction.padEnd(width, "0");
  return aFraction === bFraction ? 0 : aFraction > bFraction ? 1 : -1;
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
