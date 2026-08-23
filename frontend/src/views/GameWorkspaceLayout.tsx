import { useEffect, useRef, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm/AuthForm";
import { GamePanel } from "@/components/GamePanel/GamePanel";
import { ResolvedBetModal } from "@/components/GamePanel/ResolvedBetModal";
import { GameSessionProvider } from "@/context/GameSessionContext";
import { useGameSession } from "@/context/useGameSession";
import { usePlayer } from "@/context/usePlayer";
import { panelStyle, pageStyle } from "@/styles/ui";
import { LoadingSpinner } from "@/components/LoadingSpinner/LoadingSpinner";

function PlayerPanelContent() {
  const { playerId, isLoading, playerError } = usePlayer();

  if (isLoading) {
    return (
      <div className="grid min-h-48 place-items-center">
        <LoadingSpinner color="var(--color-accent)" size={50} />
      </div>
    );
  }

  if (playerError) {
    return (
      <div className="grid min-h-48 place-items-center text-center">
        <div>
          <strong className="block text-error">
            Could not load your player
          </strong>
          <span className="mt-2 block text-sm text-muted">
            Please reload the page and try again.
          </span>
        </div>
      </div>
    );
  }

  if (playerId) {
    return <GamePanel />;
  }

  return <AuthForm />;
}

function GameWorkspace() {
  const session = useGameSession();
  const contentPanelRef = useRef<HTMLDivElement>(null);

  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [modalOrigin, setModalOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!session.resolvedBet) return;

    const bounds = contentPanelRef.current?.getBoundingClientRect();

    setModalOrigin(
      bounds
        ? {
            x: bounds.left + bounds.width / 2 - window.innerWidth / 2,
            y: bounds.top + bounds.height / 2 - window.innerHeight / 2,
          }
        : { x: 0, y: 0 },
    );

    setIsResolutionModalOpen(true);
  }, [session.resolvedBet]);

  return (
    <div
      className={`${pageStyle} grid grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)] items-start gap-6 max-[820px]:grid-cols-1`}
    >
      <section className={`${panelStyle} relative max-[820px]:text-left`}>
        <PlayerPanelContent />
      </section>

      <div className="min-w-0" ref={contentPanelRef}>
        <Outlet />
      </div>

      {isResolutionModalOpen && session.resolvedBet && (
        <ResolvedBetModal
          bet={session.resolvedBet}
          origin={modalOrigin}
          onClose={() => setIsResolutionModalOpen(false)}
        />
      )}
    </div>
  );
}

export function GameWorkspaceLayout() {
  return (
    <GameSessionProvider>
      <GameWorkspace />
    </GameSessionProvider>
  );
}
