import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePlayer } from "@/context/usePlayer";
import {
  buttonStyle,
  fadedButtonStyle,
  modalBackdropStyle,
  modalPanelStyle,
  navigationItemStyle,
} from "@/styles/ui";

const menuActionStyle = `${buttonStyle} w-full rounded-xl bg-transparent px-3.5 py-2.5 text-left text-sm`;

export function AccountPanel() {
  const auth = usePlayer();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const closePanel = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closePanel);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closePanel);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!confirmDelete) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setConfirmDelete(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmDelete, pending]);

  async function logout() {
    setPending(true);
    setError(null);
    try {
      await auth.logout();
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
    } finally {
      setPending(false);
    }
  }

  async function deleteAccount() {
    setPending(true);
    setError(null);
    try {
      await auth.deleteAccount();
      setConfirmDelete(false);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
    } finally {
      setPending(false);
    }
  }

  if (!auth.player) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className={`${buttonStyle} ${navigationItemStyle} bg-transparent text-bitcoin hover:bg-white/5 hover:text-[#ffb14d]`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          setOpen((current) => !current);
        }}
      >
        {auth.player.username}
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+0.5rem)] right-0 z-10 w-[min(320px,calc(100vw-40px))] rounded-2xl border border-white/10 bg-[#111622]/98 p-3.5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          role="dialog"
          aria-label="Account"
        >
          <div className="grid gap-1">
            <button type="button" className={`${menuActionStyle} text-slate-200 hover:bg-white/10 hover:text-white`} disabled={pending} onClick={() => void logout()}>
              Log out
            </button>
            <button
              type="button"
              className={`${menuActionStyle} text-down hover:bg-down/10`}
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirmDelete(true);
              }}
            >
              Delete account
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-down">{error}</p>}
        </div>
      )}

      {confirmDelete && (
        <div
          className={modalBackdropStyle}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setConfirmDelete(false);
          }}
        >
          <section
            className={`${modalPanelStyle} max-w-[520px] border-down/50`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            style={{ "--modal-origin-x": "0px", "--modal-origin-y": "0px" } as CSSProperties}
          >
            <p className="mb-3 text-xs font-extrabold tracking-[0.22em] text-down">PERMANENT ACTION</p>
            <h2 className="m-0 text-[clamp(1.8rem,5vw,2.7rem)] leading-none" id="delete-account-title">Delete your account?</h2>
            <p className="mt-5 leading-7 text-slate-300" id="delete-account-description">
              Your account, score, and complete betting history will be permanently deleted.
            </p>
            {error && <p className="mt-4 text-down">{error}</p>}
            <div className="mt-7 flex gap-2.5">
              <button type="button" className={`${fadedButtonStyle} min-w-0 flex-1 text-white`} disabled={pending} autoFocus onClick={() => setConfirmDelete(false)}>
                Keep account
              </button>
              <button type="button" className={`${fadedButtonStyle} min-w-0 flex-1 text-down`} disabled={pending} onClick={() => void deleteAccount()}>
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
