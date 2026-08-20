import { Link } from "@tanstack/react-router";
import { usePlayer } from "../context/usePlayer";

export function HistoryPage() {
  const { playerId, player } = usePlayer();
  return (
    <section className="history-page">
      <p className="eyebrow">GAME HISTORY</p>
      {playerId ? (
        <>
          <h1>Your predictions</h1>
          <p className="identity">History for <strong>{player?.username}</strong></p>
          <p className="history-page__empty">No completed predictions yet.</p>
        </>
      ) : (
        <>
          <h1>Login required</h1>
          <p className="identity">Log in from the market page to see your prediction history.</p>
          <Link to="/" className="text-link">Return to market</Link>
        </>
      )}
    </section>
  );
}
