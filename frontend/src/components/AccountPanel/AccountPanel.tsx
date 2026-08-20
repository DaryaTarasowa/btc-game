import { useState, type FormEvent } from "react";
import { usePlayer } from "@/context/usePlayer";

export function AccountPanel() {
  const auth = usePlayer();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationUsername, setRegistrationUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputClass =
    "w-full rounded-xl border border-white/15 bg-[#080b12]/70 px-3.5 py-3 text-white outline-none transition focus:border-bitcoin focus:ring-2 focus:ring-bitcoin/25";
  const buttonClass =
    "cursor-pointer rounded-full border-0 bg-bitcoin px-7 py-3.5 font-extrabold text-[#14100a] transition duration-150 enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ffad42] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "login") await auth.login(email, password);
      if (mode === "register") await auth.register(email, password, registrationUsername);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

  async function accountAction(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account request failed.");
    } finally {
      setPending(false);
    }
  }

  if (auth.player) {
    return (
      <div className="mt-5 text-left">
        <div className="flex gap-2">
          <button
            type="button"
            className={`${buttonClass} min-w-0 flex-1 bg-white/10 p-2.5 text-xs text-white enabled:hover:bg-white/15`}
            disabled={pending}
            onClick={() => void accountAction(auth.logout)}
          >
            Log out
          </button>
          <button
            type="button"
            className={`${buttonClass} min-w-0 flex-1 bg-down/10 p-2.5 text-xs text-[#ffb0b7] enabled:hover:bg-down/20`}
            disabled={pending}
            onClick={() => {
              if (window.confirm("Delete your account, score, and bets permanently?")) {
                void accountAction(auth.deleteAccount);
              }
            }}
          >
            Delete account
          </button>
        </div>
        {error && <p className="mt-5.5 text-down">{error}</p>}
      </div>
    );
  }

  return (
    <form className="mb-7 grid gap-2.5" onSubmit={(event) => void submit(event)} aria-live="polite">
      {mode === "register" && (
        <input className={inputClass} aria-label="Username" value={registrationUsername} onChange={(event) => setRegistrationUsername(event.target.value)} placeholder="Username" minLength={2} maxLength={32} required />
      )}
      <input className={inputClass} aria-label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
      <input className={inputClass} aria-label="Password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength={8} required />
      <button className={buttonClass} type="submit" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <button type="button" className="cursor-pointer border-0 bg-transparent p-1.5 text-sm font-extrabold text-slate-300 transition hover:text-white" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Create an account" : "I already have an account"}
      </button>
      {error && <p className="mt-5.5 text-down">{error}</p>}
    </form>
  );
}
