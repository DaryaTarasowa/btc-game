import { Modal } from "@/components/Modal/Modal";
import { fadedButtonStyle } from "@/styles/ui";

interface ConfirmationModalProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  cancelLabel: string;
  confirmLabel: string;
  pendingLabel?: string;
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
  pending = false,
  error,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  return (
    <Modal
      className="max-w-[520px] border-error/50"
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
          className={`${fadedButtonStyle} min-w-0 flex-1 text-error`}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? pendingLabel || null : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
