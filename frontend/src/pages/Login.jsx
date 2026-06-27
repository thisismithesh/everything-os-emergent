import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/lib/api";

export default function Login() {
  const { login, setUser, setReady } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await login(email, password);
      const next = loc.state?.from || (u.role === "client" ? "/projects" : "/calendar");
      nav(next, { replace: true });
    } catch (e2) {
      setErr(formatError(e2));
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirect = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  const quickFill = (em, pw) => { setEmail(em); setPassword(pw); };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[var(--brand)] text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center">
            <span className="text-[var(--brand)] text-sm font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>S</span>
          </div>
          <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Studio PM</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60 font-semibold mb-3">A project management OS</div>
          <h1 className="text-5xl xl:text-6xl font-black tracking-tight leading-[0.95]" style={{ fontFamily: "'Cabinet Grotesk'" }}>
            Run the studio.<br />Ship the work.
          </h1>
          <p className="text-white/70 text-base mt-6 max-w-md">
            A single source of truth for projects, tasks, calendar, clients and team — built for design agencies.
          </p>
        </div>
        <div className="text-xs text-white/40">© Studio PM</div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>
            Welcome back
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Sign in to your studio.</p>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Email</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email-input"
                className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                placeholder="you@studio.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password-input"
                className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                placeholder="••••••••"
              />
            </div>
            {err && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "var(--danger-bg, #FEE2E2)", color: "var(--danger-text, #991B1B)" }} data-testid="login-error">
                {err}
              </div>
            )}
            <button
              type="submit" disabled={busy}
              data-testid="login-submit-btn"
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md py-2.5 transition-colors disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-default)]" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">or</span>
            <div className="h-px flex-1 bg-[var(--border-default)]" />
          </div>

          <button
            onClick={googleSignIn}
            data-testid="login-google-btn"
            className="w-full bg-white border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm font-semibold text-[var(--text-primary)] rounded-md py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.4 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.4 29.3 4.5 24 4.5 16.3 4.5 9.6 8.5 6.3 14.7z"/><path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.3l-6.2-5.2c-2.1 1.5-4.7 2.5-7.3 2.5-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.4 16.2 43.5 24 43.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.2-.1-2.4-.3-3.5z"/></svg>
            Continue with Google
          </button>

          <div className="mt-8 p-3 rounded-md bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2">Demo accounts</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button type="button" onClick={() => quickFill("admin@studio.com","admin123")} data-testid="demo-admin-btn"
                className="text-left px-2 py-1.5 rounded bg-white border border-[var(--border-default)] hover:bg-[var(--bg-surface-active)]">Leadership</button>
              <button type="button" onClick={() => quickFill("maya@studio.com","password123")} data-testid="demo-manager-btn"
                className="text-left px-2 py-1.5 rounded bg-white border border-[var(--border-default)] hover:bg-[var(--bg-surface-active)]">Manager</button>
              <button type="button" onClick={() => quickFill("arjun@studio.com","password123")} data-testid="demo-team-btn"
                className="text-left px-2 py-1.5 rounded bg-white border border-[var(--border-default)] hover:bg-[var(--bg-surface-active)]">Team</button>
              <button type="button" onClick={() => quickFill("client@acme.com","password123")} data-testid="demo-client-btn"
                className="text-left px-2 py-1.5 rounded bg-white border border-[var(--border-default)] hover:bg-[var(--bg-surface-active)]">Client</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
