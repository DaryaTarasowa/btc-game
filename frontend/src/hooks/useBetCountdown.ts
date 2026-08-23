import { useEffect, useState } from "react";

export function useBetCountdown(targetTimestamp?: string) {
  const [, redraw] = useState(0);

  useEffect(() => {
    if (!targetTimestamp) return;
    const timer = window.setInterval(() => redraw((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, [targetTimestamp]);

  return targetTimestamp
    ? Math.max(0, Math.ceil((Date.parse(targetTimestamp) - Date.now()) / 1_000))
    : 0;
}
