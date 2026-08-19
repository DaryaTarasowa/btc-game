export function toEpochMilliseconds(timestamp: string): number {
  const milliseconds = Date.parse(timestamp);

  if (Number.isNaN(milliseconds)) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  return milliseconds;
}
