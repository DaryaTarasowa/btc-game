import { Link, Outlet } from "@tanstack/react-router";
import { usePlayer } from "@/context/usePlayer";

export function AppLayout() {
  const { playerId } = usePlayer();
  return (
    <main className="shell">
      <header className="app-header">
        <Link to="/" className="app-brand">BTC GAME</Link>
        {playerId && (
          <nav aria-label="Main navigation">
            <Link to="/" activeOptions={{ exact: true }}>Market</Link>
            <Link to="/history">History</Link>
          </nav>
        )}
      </header>
      <Outlet />
    </main>
  );
}
