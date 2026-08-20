import { Link, Outlet } from "@tanstack/react-router";
import { usePlayer } from "@/context/usePlayer";

export function AppLayout() {
  const { playerId } = usePlayer();
  const navLink = "rounded-full px-3.5 py-2 text-sm font-bold text-slate-400 no-underline transition-colors hover:text-white";
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(247,147,26,0.2),transparent_34rem),linear-gradient(145deg,#090c13,#131929)] p-[clamp(20px,5vw,64px)]">
      <header className="mx-auto mb-6 flex w-full max-w-[1180px] items-center justify-between">
        <Link to="/" className="text-[0.82rem] font-black tracking-[0.2em] text-bitcoin no-underline">BTC GAME</Link>
        {playerId && (
          <nav className="flex gap-2" aria-label="Main navigation">
            <Link to="/" className={navLink} activeOptions={{ exact: true }} activeProps={{ className: `${navLink} bg-white/10 text-white` }}>Market</Link>
            <Link to="/history" className={navLink} activeProps={{ className: `${navLink} bg-white/10 text-white` }}>History</Link>
          </nav>
        )}
      </header>
      <Outlet />
    </main>
  );
}
