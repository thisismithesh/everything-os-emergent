import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";

const TimerContext = createContext(null);

export function TimerProvider({ children, user }) {
  const [active, setActive] = useState(null);    // { task_id, started_at, note } | null
  const [tick, setTick] = useState(0);
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!user) { setActive(null); return; }
    try {
      const { data } = await api.get("/timer/active");
      setActive(data);
    } catch {
      setActive(null);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!active) { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } return; }
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const start = async (task_id, note) => {
    const { data } = await api.post("/timer/start", { task_id, note: note || null });
    setActive(data);
    return data;
  };
  const stop = async () => {
    const { data } = await api.post("/timer/stop");
    setActive(null);
    return data;
  };

  const elapsedSeconds = active ? Math.max(0, Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000)) : 0;

  return (
    <TimerContext.Provider value={{ active, elapsedSeconds, tick, start, stop, refresh }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  return useContext(TimerContext);
}

export function formatHMS(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
