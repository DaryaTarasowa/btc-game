export const buttonStyle =
  "cursor-pointer border-0 font-extrabold transition duration-150 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70";

export const actionButtonStyle = `${buttonStyle} min-h-[68px] rounded-full px-7 py-3.5 transition enabled:hover:opacity-80`;

export const fadedButtonStyle = `${actionButtonStyle} bg-current/10 enabled:hover:bg-current/20`;

export const inputStyle =
  "w-full rounded-xl border border-white/15 bg-[#080b12]/70 px-3.5 py-3 text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25";

export const cardStyle =
  "rounded-3xl border border-white/10 bg-[#141927]/85 shadow-[0_24px_80px_rgba(0,0,0,0.4)]";

export const pageStyle = "mx-auto w-full max-w-[1180px]";

export const pageCardStyle = `${cardStyle} p-[clamp(28px,4vw,52px)] text-center`;

export const pageTitleStyle =
  "mb-7 text-[clamp(2rem,8vw,3.75rem)] leading-[0.98] tracking-[-0.045em]";

export const eyebrowStyle =
  "mb-3 text-xs font-extrabold tracking-[0.22em] text-accent uppercase";

export const metricCardStyle =
  "grid place-items-center gap-1 rounded-[18px] border px-5.5 py-3.5 text-center";

export const metricLabelStyle =
  "text-xs font-black tracking-[0.12em] uppercase";

export const metricValueStyle =
  "block leading-none font-extrabold [font-variant-numeric:tabular-nums]";

export const colors = {
  bitcoin: "#ffb14d",
  success: "#35d59a",
  error: "#ff6877",
  text: {
    primary: "#ffffff",
    secondary: "#5c6a82",
    accent: "#ffb14d",
  },
  border: "rgba(255, 255, 255, 0.06)",
  background: "#0c101b",
  panelBackground: "#111622",
};
