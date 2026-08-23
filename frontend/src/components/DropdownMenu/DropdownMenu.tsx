import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buttonStyle } from "@/styles/ui";

interface DropdownMenuAction {
  label: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  closeOnSelect?: boolean;
  onSelect: () => void;
}

interface DropdownMenuProps {
  trigger: ReactNode;
  triggerClassName: string;
  ariaLabel: string;
  actions: DropdownMenuAction[];
  error?: string | null;
  onTriggerClick?: () => void;
}

const dropdownPanelStyle =
  "absolute top-[calc(100%+0.5rem)] right-0 z-10 w-[min(320px,calc(100vw-40px))] rounded-2xl border border-opaque bg-ink p-3.5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl";

const dropdownActionStyle = `${buttonStyle} w-full rounded-xl bg-transparent px-3.5 py-2.5 text-left text-sm`;

const dropdownActionToneStyle = {
  default: "text-muted hover:bg-opaque hover:text-white",
  danger: "text-danger hover:bg-danger/10",
} as const;

export function DropdownMenu({
  trigger,
  triggerClassName,
  ariaLabel,
  actions,
  error,
  onTriggerClick,
}: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [close, open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          onTriggerClick?.();
          setOpen((current) => !current);
        }}
      >
        {trigger}
      </button>

      {open && (
        <div
          className={dropdownPanelStyle}
          role="dialog"
          aria-label={ariaLabel}
        >
          <div className="grid gap-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={`${dropdownActionStyle} ${dropdownActionToneStyle[action.tone ?? "default"]}`}
                disabled={action.disabled}
                onClick={() => {
                  action.onSelect();

                  if (action.closeOnSelect !== false) {
                    close();
                  }
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
