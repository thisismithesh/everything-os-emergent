import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { formatError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = unknown/checking
  const [ready, setReady] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // If returning from Emergent OAuth, AuthCallback handles it first.
    if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
      setReady(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    setReady(true);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setUser(false);
  };

  const value = { user, ready, login, logout, refresh: checkAuth, setUser, setReady, formatError };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Role visibility helpers
export const TABS = [
  { key: "calendar",   label: "Calendar",    roles: ["leadership", "manager", "team", "client"] },
  { key: "tasks",      label: "Tasks",       roles: ["leadership", "manager", "team"] },
  { key: "projects",   label: "Projects",    roles: ["leadership", "manager", "team", "client"] },
  { key: "team",       label: "Team",        roles: ["leadership", "manager", "team"] },
  { key: "clients",    label: "Clients",     roles: ["leadership", "manager"] },
  { key: "marketing",  label: "Marketing",   roles: ["leadership", "manager", "team"] },
  { key: "sales",      label: "Sales",       roles: ["leadership", "manager"] },
  { key: "company",    label: "Company",     roles: ["leadership", "manager", "team"] },
  { key: "dashboard",  label: "Dashboard",   roles: ["leadership", "manager"] },
  { key: "financials", label: "Financials",  roles: ["leadership", "manager"] },
];

export function canSee(tabKey, role) {
  const t = TABS.find((x) => x.key === tabKey);
  return !!t && t.roles.includes(role);
}
