import { useEffect, type CSSProperties, type ReactNode } from "react";
import { eyebrowStyle } from "@/styles/ui";

const modalBackdropStyle =
  "z-20 grid place-items-center bg-[#04060b]/80 p-6 backdrop-blur-lg motion-safe:animate-[resolution-backdrop-in_180ms_ease-out_both] cursor-pointer";

const modalPanelStyle =
  "max-h-[calc(100vh-48px)] w-full overflow-auto rounded-[26px] border bg-[#111622] p-[clamp(16px,3vw,28px)] shadow-[0_28px_100px_rgba(0,0,0,0.7)] motion-safe:animate-[resolution-dialog-in_380ms_cubic-bezier(0.16,1,0.3,1)_both]";

const modalTitleStyle = "m-0 mb-3 text-[clamp(1.8rem,5vw,2.7rem)] leading-none";

export interface ModalProps {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: string;
  role?: "dialog" | "alertdialog";
  origin?: { x: number; y: number };
  closeDisabled?: boolean;
  contained?: boolean; // whether it dimms over the whole page or only parent block
  onClose: () => void;
}

export function Modal({
  children,
  eyebrow,
  title,
  description,
  className = "",
  role = "dialog",
  origin = { x: 0, y: 0 },
  closeDisabled = false,
  contained = false,
  onClose,
}: ModalProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDisabled, onClose]);

  return (
    <div
      className={`${contained ? "absolute inset-0" : "fixed inset-0"} ${modalBackdropStyle}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) {
          console.log("here");
          onClose();
        }
      }}
    >
      <section
        className={`${modalPanelStyle} ${className}`}
        role={role}
        aria-modal="true"
        style={
          {
            "--modal-origin-x": `${origin.x}px`,
            "--modal-origin-y": `${origin.y}px`,
          } as CSSProperties
        }
      >
        {!closeDisabled && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 grid size-8 cursor-pointer place-items-center rounded-full text-xl leading-none text-muted transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        )}
        {eyebrow && <p className={`${eyebrowStyle}`}>{eyebrow}</p>}
        {title && <h2 className={`${modalTitleStyle}`}>{title}</h2>}
        {description && (
          <p className="mt-5 leading-7 text-muted">{description}</p>
        )}
        {children}
      </section>
    </div>
  );
}
