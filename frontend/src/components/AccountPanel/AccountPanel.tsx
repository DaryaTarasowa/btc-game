import { useState } from "react";
import { DropdownMenu } from "@/components/DropdownMenu/DropdownMenu";
import { ConfirmationModal } from "@/components/Modal/ConfirmationModal";
import { usePlayer } from "@/context/usePlayer";
import { buttonStyle, navigationItemStyle } from "@/styles/ui";

export function AccountPanel() {
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
        trigger={auth.player.username}
        triggerClassName={`${buttonStyle} ${navigationItemStyle} bg-transparent text-accent hover:bg-white/5 hover:text-[#ffb14d]`}
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
          pendingLabel="Deleting…"
          pending={pending}
          error={error}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteAccount()}
        />
      )}
    </>
  );
}
