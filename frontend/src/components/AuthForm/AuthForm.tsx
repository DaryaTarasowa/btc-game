import { useState, type FormEvent } from "react";
import { usePlayer } from "@/context/usePlayer";
import {
  actionButtonStyle,
  buttonStyle,
  inputStyle,
  pageTitleStyle,
} from "@/styles/ui";

const submitButtonStyle = `${actionButtonStyle} bg-bitcoin text-[#14100a] enabled:hover:-translate-y-0.5 enabled:hover:bg-[#ffad42]`;

export function AuthForm() {
  const auth = usePlayer();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationUsername, setRegistrationUsername] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "login") await auth.login(email, password);
      if (mode === "register")
        await auth.register(email, password, registrationUsername);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h1 className={pageTitleStyle}>Ready to play?</h1>
      <form
        className="grid gap-2.5"
        onSubmit={(event) => void submit(event)}
        aria-live="polite"
      >
        {mode === "register" && (
          <input
            className={inputStyle}
            aria-label="Username"
            value={registrationUsername}
            onChange={(event) => setRegistrationUsername(event.target.value)}
            placeholder="Username"
            minLength={2}
            maxLength={32}
            required
          />
        )}
        <input
          className={inputStyle}
          aria-label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
        />
        <input
          className={inputStyle}
          aria-label="Password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          minLength={8}
          required
        />
        <button className={submitButtonStyle} type="submit" disabled={pending}>
          {pending
            ? "Please wait…"
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
        <button
          type="button"
          className={`${buttonStyle} bg-transparent p-1.5 text-sm text-slate-300 hover:text-white`}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Create an account" : "I already have an account"}
        </button>
        {error && <p className="mt-3 text-sm text-down">{error}</p>}
      </form>
    </>
  );
}
