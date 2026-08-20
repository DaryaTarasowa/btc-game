import { useState, type FormEvent } from "react";
import { usePlayer } from "@/context/usePlayer";

export function LoginButton() {
  const auth = usePlayer();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError(null);
    try {
      if (mode === "login") await auth.login(email, password);
      if (mode === "register") await auth.register(email, password, username);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Authentication failed."); }
    finally { setPending(false); }
  }

  async function accountAction(action: () => Promise<void>) {
    setPending(true); setError(null);
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Account request failed."); }
    finally { setPending(false); }
  }

  if (auth.player) return <div className="account-control">
    <form onSubmit={(event) => { event.preventDefault(); void accountAction(() => auth.setUsername(username)); }}>
      <label htmlFor="profile-username">Username</label>
      <div className="inline-fields"><input id="profile-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder={auth.player.username} minLength={2} maxLength={32} required /><button type="submit" disabled={pending}>Save</button></div>
    </form>
    <div className="account-actions">
      <button type="button" className="secondary-button" disabled={pending} onClick={() => void accountAction(auth.logout)}>Log out</button>
      <button type="button" className="danger-button" disabled={pending} onClick={() => { if (window.confirm("Delete your account, score, and bets permanently?")) void accountAction(auth.deleteAccount); }}>Delete account</button>
    </div>
    {error && <p className="error">{error}</p>}
  </div>;

  return (
    <form className="login-control" onSubmit={(event) => void submit(event)} aria-live="polite">
      {mode === "register" && <input aria-label="Username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" minLength={2} maxLength={32} required />}
      <input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      <input aria-label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={8} required />
      <button type="submit" disabled={pending}>{pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
      <button type="button" className="auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Create an account" : "I already have an account"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
