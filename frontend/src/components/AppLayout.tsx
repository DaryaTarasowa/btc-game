import { Link, Outlet } from "@tanstack/react-router";
import { usePlayer } from "@/context/usePlayer";
import { AccountPanel } from "@/components/AccountPanel/AccountPanel";
import { navigationItemStyle, pageStyle } from "@/styles/ui";

export function AppLayout() {
  const { playerId } = usePlayer();
  const navLink = `${navigationItemStyle} text-slate-400 hover:text-white`;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(247,147,26,0.2),transparent_34rem),linear-gradient(145deg,#090c13,#131929)] p-[clamp(20px,5vw,64px)]">
      <header className={`${pageStyle} mb-6 flex items-center justify-between`}>
        <Link
          to="/"
          className="text-[0.82rem] font-black tracking-[0.2em] text-accent no-underline"
        >
          BTC GAME
        </Link>
        <nav className="flex items-center gap-2" aria-label="Main navigation">
          <AccountPanel />
          {playerId && (
            <>
              <Link
                to="/"
                className={navLink}
                activeOptions={{ exact: true }}
                activeProps={{ className: `${navLink} bg-white/10 text-white` }}
              >
                Market
              </Link>
              <Link
                to="/history"
                className={navLink}
                activeProps={{ className: `${navLink} bg-white/10 text-white` }}
              >
                History
              </Link>
            </>
          )}
        </nav>
      </header>
      <Outlet />
    </main>
  );
}
