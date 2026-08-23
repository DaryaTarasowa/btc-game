export const buttonStyle =
  "cursor-pointer border-0 font-extrabold transition duration-150 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70";

export const actionButtonStyle = `${buttonStyle} min-h-[68px] rounded-full px-7 py-3.5 transition enabled:hover:opacity-80 enabled:hover:-translate-y-0.5`;

export const fadedButtonStyle = `${actionButtonStyle} bg-current/10 enabled:hover:bg-current/20`;

export const inputStyle =
  "w-full rounded-xl border border-white/15 bg-input-bg px-3.5 py-3 text-input-text placeholder:text-input-text/40 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/40";

export const pageStyle = "mx-auto w-full max-w-[1180px]";

export const panelStyle = `min-[820px]:min-h-[492px] min-[820px]:p-[clamp(28px,4vw,52px)] max-[820px]:p-[clamp(18px,2vw,18px)] text-center rounded-3xl border border-opaque bg-night shadow-[0_24px_80px_rgba(0,0,0,0.4)]`;

export const sectionHeaderStyle =
  "mb-8 leading-[0.98] tracking-[-0.045em] text-[clamp(2rem,8vw,3.75rem)]";

export const eyebrowStyle =
  "mb-3 text-xs font-extrabold tracking-[0.22em] text-accent uppercase";

export const cardStyle = `
  grid place-items-center gap-1
  mx-auto mb-6 -mt-2
  rounded-[18px] border
  px-5.5 py-3.5 text-center
  shadow-[0_12px_32px_color-mix(in_srgb,var(--color-ink)_10%,transparent)]
`;

export const accentCardStyle = `${cardStyle} border-accent/50 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-accent)_20%,transparent),color-mix(in_srgb,var(--color-accent)_5%,transparent))] `;
