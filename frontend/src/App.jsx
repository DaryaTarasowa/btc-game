import { useState } from "react";

const PLAYER_ID_KEY = "btc-game.playerId.v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readStoredPlayerId() {
  const value = localStorage.getItem(PLAYER_ID_KEY);
  return value && UUID_PATTERN.test(value) ? value : null;
}

export default function App() {
  const [playerId, setPlayerId] = useState(readStoredPlayerId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function logIn() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(import.meta.env.VITE_CREATE_USER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        throw new Error(`Login failed (${response.status})`);
      }

      const player = await response.json();
      if (!player?.playerId || !UUID_PATTERN.test(player.playerId)) {
        throw new Error("The server returned an invalid player ID.");
      }

      localStorage.setItem(PLAYER_ID_KEY, player.playerId);
      setPlayerId(player.playerId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="card" aria-live="polite">
        <p className="eyebrow">BTC GAME</p>
        <h1>{playerId ? "Welcome back" : "Ready to play?"}</h1>

        {playerId ? (
          <p className="identity">
            You logged in with the id <strong>{playerId}</strong>
          </p>
        ) : (
          <button type="button" onClick={logIn} disabled={isLoading}>
            {isLoading ? "Logging in…" : "Login"}
          </button>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
