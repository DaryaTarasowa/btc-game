import { useEffect, useRef, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm/AuthForm";
import { GamePanel } from "@/components/GamePanel/GamePanel";
import { ResolvedBetModal } from "@/components/GamePanel/ResolvedBetModal";
import { GameSessionProvider } from "@/context/GameSessionContext";
import { useGameSession } from "@/context/useGameSession";
import { usePlayer } from "@/context/usePlayer";
import { pageCardStyle, pageStyle } from "@/styles/ui";

function GameWorkspace() {
  const { playerId } = usePlayer();
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
      <section className={`${pageCardStyle} max-[820px]:text-left`}>
        {playerId ? <GamePanel /> : <AuthForm />}
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
