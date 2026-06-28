import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { formatError } from "@/lib/api";

export default function Login() {
  const { login, setUser, setReady } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mode, setMode] = useState("signin");      // "signin" | "signup"
  const [signupAllowed, setSignupAllowed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Check if self sign-up is currently allowed (i.e. zero users in DB).
  useEffect(() => {
    api.get("/auth/signup-allowed")
      .then((r) => {
        setSignupAllowed(!!r.data?.allowed);
        if (r.data?.allowed) setMode("signup");
      })
      .catch(() => setSignupAllowed(false));
  }, []);

  const goNext = (role) => {
    const next = loc.state?.from || (role === "client" ? "/projects" : "/home");
    nav(next, { replace: true });
  };

  const submitSignin = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const u = await login(email, password);
      goNext(u.role);
    } catch (e2) { setErr(formatError(e2)); } finally { setBusy(false); }
  };

  const submitSignup = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { data } = await api.post("/auth/signup", { name, email, password });
      setUser(data); setReady(true);
      goNext(data.role);
    } catch (e2) { setErr(formatError(e2)); } finally { setBusy(false); }
  };

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
          {mode === "signin" ? (
            <>
              <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Welcome back</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Sign in to your studio.</p>
              <form onSubmit={submitSignin} className="mt-8 space-y-4" data-testid="login-form">
                <Field label="Email">
                  <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} data-testid="login-email-input"
                    className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                    placeholder="you@studio.com" />
                </Field>
                <Field label="Password">
                  <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} data-testid="login-password-input"
                    className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                    placeholder="••••••••" />
                </Field>
                {err && <Error msg={err} />}
                <button type="submit" disabled={busy} data-testid="login-submit-btn"
                  className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md py-2.5 transition-colors disabled:opacity-50">
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>
              {signupAllowed && (
                <p className="mt-6 text-xs text-center text-[var(--text-secondary)]">
                  No accounts yet?{" "}
                  <button type="button" onClick={()=>{setMode("signup"); setErr("");}} data-testid="switch-to-signup" className="font-semibold text-[var(--text-primary)] hover:underline">
                    Create the first account
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Create your account</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {signupAllowed ? "You'll be the studio's first user (leadership)." : "Sign-up is currently disabled."}
              </p>
              <form onSubmit={submitSignup} className="mt-8 space-y-4" data-testid="signup-form">
                <Field label="Full name">
                  <input type="text" required value={name} onChange={(e)=>setName(e.target.value)} data-testid="signup-name-input"
                    className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                    placeholder="Aanya Iyer" disabled={!signupAllowed} />
                </Field>
                <Field label="Email">
                  <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} data-testid="signup-email-input"
                    className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                    placeholder="you@studio.com" disabled={!signupAllowed} />
                </Field>
                <Field label="Password">
                  <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} data-testid="signup-password-input"
                    className="mt-1 w-full bg-white border border-[var(--border-default)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                    placeholder="At least 8 characters" disabled={!signupAllowed} />
                </Field>
                {err && <Error msg={err} />}
                <button type="submit" disabled={busy || !signupAllowed} data-testid="signup-submit-btn"
                  className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md py-2.5 transition-colors disabled:opacity-50">
                  {busy ? "Creating…" : "Create account"}
                </button>
              </form>
              <p className="mt-6 text-xs text-center text-[var(--text-secondary)]">
                Already have an account?{" "}
                <button type="button" onClick={()=>{setMode("signin"); setErr("");}} data-testid="switch-to-signin" className="font-semibold text-[var(--text-primary)] hover:underline">
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">{label}</span>
      {children}
    </label>
  );
}

function Error({ msg }) {
  return (
    <div className="text-xs px-3 py-2 rounded-md" style={{ background: "var(--danger-bg, #FEE2E2)", color: "var(--danger-text, #991B1B)" }} data-testid="login-error">
      {msg}
    </div>
  );
}
