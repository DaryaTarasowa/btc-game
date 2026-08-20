export const buttonStyle =
  "cursor-pointer border-0 font-extrabold transition duration-150 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70";

export const actionButtonStyle =
  `${buttonStyle} min-h-[68px] rounded-full px-7 py-3.5`;

export const fadedButtonStyle =
  `${actionButtonStyle} bg-current/10 enabled:hover:bg-current/20`;

export const inputStyle =
  "w-full rounded-xl border border-white/15 bg-[#080b12]/70 px-3.5 py-3 text-white outline-none transition focus:border-bitcoin focus:ring-2 focus:ring-bitcoin/25";

export const cardStyle =
  "rounded-3xl border border-white/10 bg-[#141927]/85 shadow-[0_24px_80px_rgba(0,0,0,0.4)]";

export const pageStyle = "mx-auto w-full max-w-[1180px]";

export const pageCardStyle =
  `${cardStyle} p-[clamp(28px,4vw,52px)] text-center`;

export const pageTitleStyle =
  "mb-7 text-[clamp(2rem,8vw,3.75rem)] leading-[0.98] tracking-[-0.045em]";

export const eyebrowStyle =
  "mb-3 text-xs font-extrabold tracking-[0.22em] text-bitcoin";

export const metricCardStyle =
  "grid place-items-center gap-1 rounded-[18px] border px-5.5 py-3.5 text-center";

export const metricLabelStyle =
  "text-xs font-black tracking-[0.12em] uppercase";

export const metricValueStyle =
  "block leading-none font-extrabold [font-variant-numeric:tabular-nums]";

export const navigationItemStyle =
  "rounded-full px-3.5 py-2 text-sm font-bold no-underline transition-colors";

export const modalBackdropStyle =
  "fixed inset-0 z-20 grid place-items-center bg-[#04060b]/80 p-6 backdrop-blur-lg motion-safe:animate-[resolution-backdrop-in_180ms_ease-out_both]";

export const modalPanelStyle =
  "max-h-[calc(100vh-48px)] w-full overflow-auto rounded-[26px] border bg-[#111622] p-[clamp(16px,3vw,28px)] shadow-[0_28px_100px_rgba(0,0,0,0.7)] motion-safe:animate-[resolution-dialog-in_380ms_cubic-bezier(0.16,1,0.3,1)_both]";
