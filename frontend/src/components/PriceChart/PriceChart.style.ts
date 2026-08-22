export interface PriceChartColors {
  accent: string;
  graph: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  mutedText: string;
}

export interface PriceChartTheme {
  colors: PriceChartColors;
  fill: { top: string; bottom: string };
  crosshair: string;
  grid: string;
  axisBorder: string;
  frame: {
    border: string;
    background: string;
    shadow: string;
  };
  state: {
    background: string;
    border: string;
  };
  tooltip: {
    background: string;
    border: string;
    shadow: string;
  };
  guideDotBorder: string;
}

export const defaultPriceChartColors: PriceChartColors = {
  accent: "#f7931a",
  graph: "#f7931a",
  background: "#0b0e16",
  surface: "#f7931a",
  border: "#8490a9",
  text: "#ffffff",
  mutedText: "#8490a9",
};

export function createPriceChartTheme(
  overrides: Partial<PriceChartColors> = {},
): PriceChartTheme {
  const palette = {
    ...defaultPriceChartColors,
    ...overrides,
  };

  const surface = mixHex(palette.background, palette.surface, 0.18);

  return {
    colors: palette,

    fill: {
      top: withAlpha(palette.graph, 0.25),
      bottom: withAlpha(palette.graph, 0.015),
    },

    crosshair: withAlpha(palette.accent, 0.4),
    grid: withAlpha(palette.border, 0.055),
    axisBorder: withAlpha(palette.border, 0.1),

    frame: {
      border: `${withAlpha(palette.border, 0.4)} 0.25px solid`,
      background: `linear-gradient(150deg, ${withAlpha(
        surface,
        0.75,
      )}, ${withAlpha(palette.background, 0.96)})`,
      shadow: `0 24px 80px ${withAlpha(palette.background, 0.72)}`,
    },

    state: {
      background: withAlpha(palette.background, 0.85),
      border: withAlpha(palette.border, 0.1),
    },

    tooltip: {
      background: withAlpha(palette.background, 0.95),
      border: withAlpha(palette.accent, 0.35),
      shadow: `0 8px 28px ${withAlpha(palette.background, 0.75)}`,
    },

    guideDotBorder: mixHex(palette.background, palette.surface, 0.35),
  };
}

export const defaultPriceChartTheme = createPriceChartTheme();

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(base: string, tint: string, tintWeight: number): string {
  const left = parseHex(base);
  const right = parseHex(tint);
  const weight = Math.min(1, Math.max(0, tintWeight));

  const channel = (baseChannel: number, tintChannel: number) =>
    Math.round(baseChannel * (1 - weight) + tintChannel * weight);

  return toHex(
    channel(left.r, right.r),
    channel(left.g, right.g),
    channel(left.b, right.b),
  );
}

function parseHex(hex: string) {
  const normalized = hex.replace("#", "");

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(
      `PriceChart colors must use six-digit hex values. Received: ${hex}`,
    );
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
