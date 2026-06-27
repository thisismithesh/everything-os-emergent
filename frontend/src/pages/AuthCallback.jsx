import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const nav = useNavigate();
  const loc = useLocation();
  const { setUser, setReady } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = window.location.hash || loc.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/login", { replace: true }); return; }
    const session_id = decodeURIComponent(m[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/emergent-session", { session_id });
        setUser(data);
        setReady(true);
        // strip hash
        window.history.replaceState(null, "", window.location.pathname);
        const next = data.role === "client" ? "/projects" : "/home";
        nav(next, { replace: true });
      } catch {
        nav("/login", { replace: true });
      }
    })();
  }, [loc, nav, setUser, setReady]);

  return (
    <div className="h-screen flex items-center justify-center text-sm text-[var(--text-tertiary)]">
      Signing you in…
    </div>
  );
}
