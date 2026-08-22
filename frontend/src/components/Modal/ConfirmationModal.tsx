import { Modal } from "@/components/Modal/Modal";
import { fadedButtonStyle } from "@/styles/ui";
import React from "react";

interface ConfirmationModalProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel?: React.ReactNode;
  tone?: "default" | "danger";
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationModal({
  eyebrow,
  title,
  description,
  cancelLabel,
  confirmLabel,
  pendingLabel,
  tone = "default",
  pending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const confirmStyle = tone === "danger" ? "text-error" : "text-accent";

  const borderStyle =
    tone === "danger" ? "border-error/50" : "border-accent/50";

  return (
    <Modal
      className={`max-w-[520px] ${borderStyle}`}
      role="alertdialog"
      closeDisabled={pending}
      onClose={onCancel}
      eyebrow={eyebrow}
      title={title}
      description={description}
    >
      {error && <p className="mt-4 text-error">{error}</p>}

      <div className="mt-7 flex gap-2.5">
        <button
          type="button"
          className={`${fadedButtonStyle} min-w-0 flex-1 text-white`}
          disabled={pending}
          autoFocus
          onClick={onCancel}
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          className={`${fadedButtonStyle} min-w-0 flex-1 ${confirmStyle}`}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? (pendingLabel ?? null) : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
