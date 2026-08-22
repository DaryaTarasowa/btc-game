import { Link, Outlet } from "@tanstack/react-router";
import { usePlayer } from "@/context/usePlayer";
import { AccountPanel } from "@/components/AccountPanel/AccountPanel";
import { pageStyle } from "@/styles/ui";

const navigationItemStyle =
  "rounded-full px-3.5 py-2 text-sm font-bold no-underline transition-colors text-muted hover:text-white";

export function AppLayout() {
  const { playerId } = usePlayer();
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--color-accent)_20%,transparent),transparent_34rem),linear-gradient(145deg,var(--color-ink),var(--color-night))] p-[clamp(20px,5vw,64px)]">
      <header className={`${pageStyle} mb-6 flex items-center justify-between`}>
        <Link
          to="/"
          className="text-[0.82rem] font-black tracking-[0.2em] text-accent no-underline"
        >
          BTC GAME
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          {playerId && (
            <>
              <Link
                to="/"
                className={navigationItemStyle}
                activeOptions={{ exact: true }}
                activeProps={{
                  className: `${navigationItemStyle} bg-white/15 text-white`,
                }}
              >
                Market
              </Link>
              <Link
                to="/history"
                className={navigationItemStyle}
                activeProps={{
                  className: `${navigationItemStyle} bg-white/15 text-white`,
                }}
              >
                History
              </Link>
            </>
          )}
          <AccountPanel />
        </nav>
      </header>
      <Outlet />
    </main>
  );
}
