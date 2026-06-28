import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const TOKEN_KEY = "studio_pm_access_token";

export function getAccessToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}
export function clearAccessToken() { setAccessToken(null); }

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Attach Authorization header if we have a token (fallback for iframe/3rd-party cookie blocks)
api.interceptors.request.use((config) => {
  const t = getAccessToken();
  if (t) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${t}`;
  }
  return config;
});

export function formatError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong.";
  if (typeof d === "string") return d;
  if (Array.isArray(d))
    return d.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (typeof d.msg === "string") return d.msg;
  return String(d);
}

export default api;
