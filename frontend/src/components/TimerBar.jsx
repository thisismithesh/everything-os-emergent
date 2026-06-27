import { useEffect, useState } from "react";
import { Square, Timer } from "lucide-react";
import { useTimer, formatHMS } from "@/contexts/TimerContext";
import api from "@/lib/api";

export default function TimerBar() {
  const t = useTimer();
  const [taskName, setTaskName] = useState("");

  useEffect(() => {
    if (t?.active?.task_id) {
      api.get(`/tasks?project_id=`).then((r) => {
        const m = r.data.find((x) => x.id === t.active.task_id);
        setTaskName(m?.name || "");
      }).catch(() => setTaskName(""));
    } else {
      setTaskName("");
    }
  }, [t?.active?.task_id]);

  if (!t?.active) return null;
  return (
    <div className="mx-3 mb-3 rounded-md bg-[var(--brand)] text-white p-3" data-testid="timer-bar">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Timer className="w-4 h-4 shrink-0" strokeWidth={2} />
          <div className="text-[10px] uppercase tracking-widest font-semibold text-white/60">Tracking</div>
        </div>
        <button
          onClick={t.stop}
          data-testid="timer-stop-btn"
          className="p-1.5 rounded-md bg-white/15 hover:bg-white/25 transition-colors"
          aria-label="Stop timer"
        >
          <Square className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="mt-1 text-sm font-medium truncate" data-testid="timer-task-name">{taskName || "Active task"}</div>
      <div className="mt-1 text-2xl font-black tabular-nums tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }} data-testid="timer-elapsed">
        {formatHMS(t.elapsedSeconds)}
      </div>
    </div>
  );
}
