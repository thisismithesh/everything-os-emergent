import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, Empty } from "@/components/ui-bits";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function startOfWeek(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0,0,0,0); return x; }
function fmt(d) { return d.toISOString().slice(0,10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

export default function Timesheets() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [entries, setEntries] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [scope, setScope] = useState("me"); // me | team
  const [userId, setUserId] = useState(""); // when team, filter by user

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const rangeStart = fmt(days[0]);
  const rangeEnd = fmt(days[6]);

  const load = async () => {
    const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
    if (scope === "me" && user) params.set("user_id", user.id);
    else if (userId) params.set("user_id", userId);
    const { data } = await api.get(`/time-entries?${params.toString()}`);
    setEntries(data);
    const t = await api.get("/tasks").then((r) => r.data).catch(() => []);
    setTasks(t);
    const u = await api.get("/users").then((r) => r.data).catch(() => []);
    setUsers(u);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rangeStart, rangeEnd, scope, userId]);

  const taskById = (id) => tasks.find((t) => t.id === id);
  const userById = (id) => users.find((u) => u.id === id);

  // Group: rows by task (or task+user when team scope), cols by day
  const grouped = useMemo(() => {
    const map = {};
    for (const e of entries) {
      const dKey = e.start_time?.slice(0, 10);
      const rowKey = scope === "me" ? e.task_id : `${e.task_id}|${e.user_id}`;
      if (!map[rowKey]) map[rowKey] = { task_id: e.task_id, user_id: e.user_id, days: {}, total: 0 };
      map[rowKey].days[dKey] = (map[rowKey].days[dKey] || 0) + (e.duration_minutes || 0);
      map[rowKey].total += (e.duration_minutes || 0);
    }
    return Object.values(map);
  }, [entries, scope]);

  const dayTotals = useMemo(() => {
    const out = {};
    days.forEach((d) => { out[fmt(d)] = 0; });
    grouped.forEach((g) => { Object.entries(g.days).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }); });
    return out;
  }, [days, grouped]);

  const weekTotal = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const hours = (mins) => (mins/60).toFixed(2);

  return (
    <>
      <PageHeader eyebrow="Timesheets" title={`Week of ${days[0].toLocaleDateString(undefined, { month:"short", day:"numeric" })} – ${days[6].toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" })}`} description="Weekly time entries from timer + manual logs.">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" data-testid="timesheet-prev-week" aria-label="Previous week"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm" data-testid="timesheet-this-week">This week</button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" data-testid="timesheet-next-week" aria-label="Next week"><ChevronRight className="w-4 h-4" /></button>
        {user && (user.role === "leadership" || user.role === "manager") && (
          <select value={scope === "me" ? "me" : (userId || "all")} onChange={(e) => { if (e.target.value === "me") { setScope("me"); setUserId(""); } else { setScope("team"); setUserId(e.target.value === "all" ? "" : e.target.value); } }} className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white" data-testid="timesheet-scope-select">
            <option value="me">My timesheet</option>
            <option value="all">All team</option>
            {users.filter((u)=>u.role!=="client").map((u)=> <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </PageHeader>

      <div className="p-8 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Week total" value={`${hours(weekTotal)}h`} />
          <Kpi label="Daily avg" value={`${hours(weekTotal/5)}h`} sub="business days" />
          <Kpi label="Entries" value={entries.length} />
          <Kpi label="Tasks" value={new Set(entries.map((e)=>e.task_id)).size} />
        </div>

        {grouped.length === 0 ? (
          <Empty title="No time logged this week" hint="Start a timer on a task or add a manual entry from the task drawer." />
        ) : (
          <div className="bg-white border border-[var(--border-default)] rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
                <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                  <th className="px-4 py-2">Task</th>
                  {scope !== "me" && <th className="px-4 py-2">Member</th>}
                  {days.map((d) => (
                    <th key={fmt(d)} className="px-3 py-2 text-right">
                      {d.toLocaleDateString(undefined, { weekday: "short" })}<br />
                      <span className="text-[var(--text-secondary)]">{d.getDate()}</span>
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((g, i) => {
                  const tk = taskById(g.task_id);
                  const u = userById(g.user_id);
                  return (
                    <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`timesheet-row-${i}`}>
                      <td className="px-4 py-3 font-medium">{tk?.name || "(deleted task)"}</td>
                      {scope !== "me" && <td className="px-4 py-3"><div className="flex items-center gap-2">{u && <Avatar user={u} size={20} />}<span>{u?.name || "—"}</span></div></td>}
                      {days.map((d) => {
                        const v = g.days[fmt(d)] || 0;
                        return <td key={fmt(d)} className="px-3 py-3 text-right tabular-nums text-[var(--text-secondary)]">{v ? hours(v) : "—"}</td>;
                      })}
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{hours(g.total)}h</td>
                    </tr>
                  );
                })}
                <tr className="bg-[var(--bg-surface-hover)] border-t border-[var(--border-default)]">
                  <td className="px-4 py-3 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold" colSpan={scope === "me" ? 1 : 2}>Day total</td>
                  {days.map((d) => <td key={fmt(d)} className="px-3 py-3 text-right tabular-nums font-semibold">{dayTotals[fmt(d)] ? hours(dayTotals[fmt(d)]) : "—"}</td>)}
                  <td className="px-4 py-3 text-right tabular-nums font-black">{hours(weekTotal)}h</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-4">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{value}</div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</div>}
    </div>
  );
}
