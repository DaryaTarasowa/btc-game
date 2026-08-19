import { useCreatePlayer } from "../../queries/useCreatePlayer";

export function LoginButton() {
  const createPlayer = useCreatePlayer();
  return (
    <div className="login-control" aria-live="polite">
      <button type="button" onClick={() => createPlayer.mutate()} disabled={createPlayer.isPending}>
        {createPlayer.isPending ? "Logging in…" : "Login"}
      </button>
      {createPlayer.isError && <p className="error">{createPlayer.error.message}</p>}
    </div>
  );
}
