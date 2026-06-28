import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack } from "@/components/ui-bits";
import { ChevronLeft, ChevronRight, Plus, Download, X, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const TYPE_COLORS = {
  project: "#2563EB",
  company: "#0A0A0A",
  recurring: "#9333EA",
  personal: "#16A34A",
};
const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function daysInGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const weekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - weekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
const fmtIsoDate = (d) => d.toISOString().slice(0, 10);

export default function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [users, setUsers] = useState([]);
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [showAdd, setShowAdd] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const load = () => Promise.all([
    api.get("/events").then((r) => setEvents(r.data)).catch(() => setEvents([])),
    api.get("/leaves").then((r) => setLeaves(r.data)).catch(() => setLeaves([])),
    api.get("/users").then((r) => setUsers(r.data)).catch(() => setUsers([])),
  ]);

  useEffect(() => { load(); }, []);

  const grid = useMemo(() => daysInGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date(); today.setHours(0,0,0,0);

  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const leavesByDay = useMemo(() => {
    const map = {};
    for (const l of leaves) {
      const s = new Date(l.start_date); const e = new Date(l.end_date);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
        const k = fmtIsoDate(new Date(d));
        if (!map[k]) map[k] = [];
        map[k].push(l);
      }
    }
    return map;
  }, [leaves]);

  const userById = useMemo(() => { const m = {}; users.forEach((u)=>m[u.id]=u); return m; }, [users]);

  const canEdit = user && user.role !== "client";

  return (
    <>
      <PageHeader eyebrow="Calendar" title={monthLabel} description="Project events, company events, and team leaves.">
        <button onClick={() => setCursor(addMonths(cursor, -1))} data-testid="calendar-prev-month" className="p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={() => setCursor(startOfMonth(new Date()))} data-testid="calendar-today-btn" className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm">Today</button>
        <button onClick={() => setCursor(addMonths(cursor, 1))} data-testid="calendar-next-month" className="p-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
        <a href={`${import.meta.env.REACT_APP_BACKEND_URL}/api/export/events.csv`} data-testid="calendar-export-btn" className="ml-2 px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2"><Download className="w-4 h-4" /> Export</a>
        {canEdit && (
          <button onClick={() => setShowAdd(true)} data-testid="calendar-add-event-btn" className="ml-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2"><Plus className="w-4 h-4" /> Event</button>
        )}
      </PageHeader>

      <div className="p-8">
        <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border-default)]">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
              <div key={d} className="px-3 py-2 text-[10px] uppercase tracking-widest font-semibold text-[var(--text-tertiary)]">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = d.getTime() === today.getTime();
              const key = fmtIsoDate(d);
              const evs = eventsByDay[key] || [];
              const lvs = leavesByDay[key] || [];
              return (
                <div key={i} data-testid={`calendar-cell-${key}`} className={`min-h-[110px] border-r border-b border-[var(--border-subtle)] p-2 ${inMonth ? "bg-white" : "bg-[var(--bg-surface-hover)]"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${isToday ? "bg-[var(--brand)] text-white rounded-full w-6 h-6 inline-flex items-center justify-center font-bold" : inMonth ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-tertiary)]"}`}>{d.getDate()}</span>
                    {lvs.length > 0 && <span className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)]">{lvs.length} leave</span>}
                  </div>
                  <div className="mt-1 space-y-1">
                    {evs.slice(0, 3).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEditingEvent(e)}
                        data-testid={`calendar-event-${e.id}`}
                        className="block text-left w-full text-[11px] truncate rounded-sm px-1.5 py-0.5 text-white hover:opacity-90"
                        style={{ background: TYPE_COLORS[e.type] || "#2563EB" }}
                        title={`${e.name}${e.time ? " · " + e.time : ""}`}
                      >
                        {e.time && <span className="opacity-80 mr-1">{e.time}</span>}{e.name}
                      </button>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-[var(--text-tertiary)]">+{evs.length - 3} more</div>}
                    {lvs.slice(0, 2).map((l, idx) => {
                      const u = userById[l.user_id];
                      return (
                        <div key={idx} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                          {u && <Avatar user={u} size={14} />}
                          <span className="truncate">{u?.name?.split(" ")[0] || "Team"} · leave</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAdd && <EventFormModal users={users} onClose={() => setShowAdd(false)} onSaved={load} canEdit={canEdit} />}
      {editingEvent && <EventFormModal event={editingEvent} users={users} onClose={() => setEditingEvent(null)} onSaved={load} canEdit={canEdit} />}
    </>
  );
}

export function EventFormModal({ event, users, projectId, onClose, onSaved, canEdit = true }) {
  const isEdit = !!event;
  const [name, setName] = useState(event?.name || "");
  const [date, setDate] = useState(event?.date || fmtIsoDate(new Date()));
  const [time, setTime] = useState(event?.time || "10:00");
  const [endTime, setEndTime] = useState(event?.end_time || "11:00");
  const [location, setLocation] = useState(event?.location || "");
  const [type, setType] = useState(event?.type || (projectId ? "project" : "project"));
  const [attendees, setAttendees] = useState(event?.attendees || []);
  const [recurrenceRule, setRecurrenceRule] = useState(event?.recurrence_rule || "weekly");
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(event?.project_id || projectId || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const readOnly = !canEdit;

  useEffect(() => { api.get("/projects").then((r)=>setProjects(r.data)).catch(()=>{}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (readOnly) { onClose(); return; }
    setBusy(true); setErr("");
    try {
      const payload = {
        name, date, time, end_time: endTime, location, type, attendees,
        project_id: type === "project" ? (pid || null) : null,
        recurrence_rule: type === "recurring" ? recurrenceRule : null,
      };
      if (isEdit) await api.patch(`/events/${event.id}`, payload);
      else await api.post("/events", payload);
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };

  const del = async () => {
    if (!isEdit || readOnly) return;
    if (!window.confirm(`Delete event "${event.name}"?`)) return;
    setBusy(true);
    try { await api.delete(`/events/${event.id}`); onSaved && onSaved(); onClose(); }
    catch { setErr("Failed to delete"); } finally { setBusy(false); }
  };

  const toggleAtt = (id) => setAttendees((a) => a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="event-form-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{isEdit ? (readOnly ? "Event" : "Edit event") : "New event"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-surface-hover)]" aria-label="Close" data-testid="event-form-close"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Event name" data-testid="event-name-input" disabled={readOnly}
            className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" />
          <div className="grid grid-cols-3 gap-2">
            <input type="date" required value={date} onChange={(e)=>setDate(e.target.value)} data-testid="event-date-input" disabled={readOnly}
              className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" />
            <input type="time" value={time} onChange={(e)=>setTime(e.target.value)} data-testid="event-time-input" disabled={readOnly}
              className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" />
            <input type="time" value={endTime} onChange={(e)=>setEndTime(e.target.value)} data-testid="event-endtime-input" disabled={readOnly}
              className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" />
          </div>
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location" data-testid="event-location-input" disabled={readOnly}
            className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" />
          <div className="grid grid-cols-2 gap-2">
            <select value={type} onChange={(e)=>setType(e.target.value)} data-testid="event-type-select" disabled={readOnly}
              className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]">
              <option value="project">Project event</option>
              <option value="company">Company event</option>
              <option value="recurring">Recurring</option>
              <option value="personal">Personal</option>
            </select>
            {type === "project" && (
              <select value={pid} onChange={(e)=>setPid(e.target.value)} data-testid="event-project-select" disabled={readOnly}
                className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]">
                <option value="">— Select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {type === "recurring" && (
              <select value={recurrenceRule} onChange={(e)=>setRecurrenceRule(e.target.value)} data-testid="event-recurrence-select" disabled={readOnly}
                className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]">
                {RECURRENCE_OPTIONS.map((o)=> <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Attendees</div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {users.map((u) => (
                <button type="button" key={u.id} onClick={() => toggleAtt(u.id)} disabled={readOnly}
                  className={`text-xs rounded-full px-2.5 py-1 border ${attendees.includes(u.id) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--text-secondary)] border-[var(--border-default)]"}`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-between items-center pt-2">
            <div>
              {isEdit && canEdit && (
                <button type="button" onClick={del} className="px-3 py-2 text-sm rounded-md text-red-600 hover:bg-red-50 flex items-center gap-1" data-testid="event-delete-btn"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" data-testid="event-cancel-btn">Close</button>
              {canEdit && (
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="event-save-btn">{busy?"Saving…":(isEdit?"Save":"Create")}</button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
