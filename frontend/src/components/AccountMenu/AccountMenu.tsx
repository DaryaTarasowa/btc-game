import { useState } from "react";
import { DropdownMenu } from "@/components/DropdownMenu/DropdownMenu";
import { ConfirmationModal } from "@/components/Modal/ConfirmationModal";
import { usePlayer } from "@/context/usePlayer";
import { buttonStyle } from "@/styles/ui";
import { LoadingSpinner } from "@/components/LoadingSpinner/LoadingSpinner";

export function AccountMenu() {
  const auth = usePlayer();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setError(null);

    try {
      await auth.logout();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Account request failed.",
      );
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Account request failed.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!auth.player) return null;

  return (
    <>
      <DropdownMenu
        trigger={
          <span className="flex items-center gap-2">
            <span
              className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-black text-accent"
              aria-hidden="true"
            >
              {auth.player.username.charAt(0).toUpperCase()}
            </span>

            <span className="hidden min-[400px]:inline">
              {auth.player.username}
            </span>

            <span className="text-[10px] text-muted" aria-hidden="true">
              ▼
            </span>
          </span>
        }
        triggerClassName={`${buttonStyle} flex items-center rounded-full bg-transparent px-3 py-2 text-accent hover:bg-white/15`}
        ariaLabel="Account"
        onTriggerClick={() => setError(null)}
        actions={[
          {
            label: "Log out",
            disabled: pending,
            onSelect: () => void logout(),
          },
          {
            label: "Delete account",
            tone: "danger",
            disabled: pending,
            onSelect: () => setConfirmDelete(true),
          },
        ]}
        error={error}
      />

      {confirmDelete && (
        <ConfirmationModal
          eyebrow="PERMANENT ACTION"
          title="Delete your account?"
          description="Your account, score, and complete betting history will be permanently deleted."
          cancelLabel="Keep account"
          confirmLabel="Delete permanently"
          pendingLabel={<LoadingSpinner label="Deleting..." />}
          tone="danger"
          pending={pending}
          error={error}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteAccount()}
        />
      )}
    </>
  );
}
