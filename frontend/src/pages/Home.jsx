// Home (default landing). Shows today's events, my open tasks, my projects, and a Log Leave button.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarStack, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";
import { CalendarPlus, Plane, ChevronRight, Clock } from "lucide-react";
import AddLeaveModal from "@/components/AddLeaveModal";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function inNextDays(iso, n) {
  if (!iso) return false;
  const t = new Date(); t.setHours(0,0,0,0);
  const e = new Date(iso); e.setHours(0,0,0,0);
  const limit = new Date(t); limit.setDate(t.getDate() + n);
  return e >= t && e <= limit;
}

const PROJECT_TYPE_LABEL = {
  billable_regular: "Billable Project",
  billable_retainer: "Billable Account",
  non_billable: "Non-Billable Project",
};

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [showLeave, setShowLeave] = useState(false);

  const load = () => Promise.all([
    api.get("/tasks").then((r)=>setTasks(r.data)).catch(()=>setTasks([])),
    api.get("/events").then((r)=>setEvents(r.data)).catch(()=>setEvents([])),
    api.get("/projects").then((r)=>setProjects(r.data)).catch(()=>setProjects([])),
    api.get("/users").then((r)=>setUsers(r.data)).catch(()=>setUsers([])),
  ]);
  useEffect(() => { load(); }, []);

  const userById = useMemo(() => { const m = {}; users.forEach((u)=>m[u.id]=u); return m; }, [users]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    return tasks
      .filter((t) => (t.assignees || []).includes(user.id))
      .filter((t) => t.status !== "done")
      .sort((a,b)=> (a.latest_deadline || "9999").localeCompare(b.latest_deadline || "9999"));
  }, [tasks, user]);

  const myEvents = useMemo(() => {
    if (!user) return [];
    return events
      .filter((e) => e.type === "company" || (e.attendees || []).includes(user.id))
      .filter((e) => inNextDays(e.date, 7))
      .sort((a,b)=> (a.date || "").localeCompare(b.date || ""));
  }, [events, user]);

  const myProjects = useMemo(() => {
    if (!user) return [];
    if (user.role === "client") return projects;
    return projects.filter((p) => (p.members || []).some((m) => m.user_id === user.id));
  }, [projects, user]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Burning the midnight oil";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <>
      <PageHeader eyebrow="Home" title={`${greeting}, ${user?.name?.split(" ")[0] || ""}.`} description="Everything you have on your plate, in one view.">
        {user && (user.role !== "client") && (
          <button onClick={()=>setShowLeave(true)} className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2" data-testid="home-add-leave-btn">
            <Plane className="w-4 h-4" /> Log time off
          </button>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tasks */}
          <section className="bg-white border border-[var(--border-default)] rounded-md p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>My open tasks ({myTasks.length})</h3>
              <Link to="/tasks" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">All tasks <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {myTasks.length === 0 ? <Empty title="No open tasks" hint="When work is assigned to you, it will appear here." /> : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {myTasks.slice(0, 8).map((t) => (
                  <li key={t.id} className="py-2.5 flex items-center gap-3 hover:bg-[var(--bg-surface-hover)] -mx-2 px-2 rounded cursor-pointer" onClick={()=>nav(`/tasks?task=${t.id}`)} data-testid={`home-task-${t.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                        {t.category && <span className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-hover)] uppercase tracking-widest font-semibold">{t.category}</span>}
                        {t.latest_deadline && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(t.latest_deadline)}</span>}
                      </div>
                    </div>
                    <StatusPill status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Events */}
          <section className="bg-white border border-[var(--border-default)] rounded-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>This week</h3>
              <Link to="/calendar" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">Calendar <ChevronRight className="w-3 h-3" /></Link>
            </div>
            {myEvents.length === 0 ? <Empty title="Nothing scheduled" hint="The next 7 days are wide open." /> : (
              <ul className="space-y-3">
                {myEvents.slice(0, 8).map((e) => (
                  <li key={e.id} className="flex gap-3" data-testid={`home-event-${e.id}`}>
                    <div className="w-12 shrink-0 text-center bg-[var(--bg-surface-hover)] rounded-md py-1">
                      <div className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{new Date(e.date).toLocaleDateString(undefined,{ month:"short" })}</div>
                      <div className="text-lg font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{new Date(e.date).getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.name}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)]">{e.time || ""}{e.location ? ` · ${e.location}` : ""}</div>
                      <div className="mt-1"><AvatarStack users={(e.attendees||[]).map((id)=>userById[id]).filter(Boolean)} size={18} max={5} /></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Projects */}
        <section className="bg-white border border-[var(--border-default)] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>My projects ({myProjects.length})</h3>
            <Link to="/projects" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">All projects <ChevronRight className="w-3 h-3" /></Link>
          </div>
          {myProjects.length === 0 ? <Empty title="You're not assigned to any projects yet" /> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {myProjects.slice(0, 9).map((p) => {
                const team = (p.members||[]).map((m)=>userById[m.user_id]).filter(Boolean);
                return (
                  <Link key={p.id} to={`/projects/${p.id}`} data-testid={`home-project-${p.id}`}
                    className="block bg-white border border-[var(--border-default)] rounded-md p-4 hover:bg-[var(--bg-surface-hover)] transition-colors">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{PROJECT_TYPE_LABEL[p.type] || p.type}</div>
                    <div className="text-base font-bold tracking-tight mt-0.5" style={{ fontFamily: "'Cabinet Grotesk'" }}>{p.name}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <StatusPill status={p.status} />
                      <HealthDot health={p.health} />
                    </div>
                    <div className="flex items-end justify-between mt-3">
                      <AvatarStack users={team} size={20} />
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
                        {p.end_date ? `Due ${p.end_date.slice(5)}` : "—"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {showLeave && user && <AddLeaveModal userId={user.id} onClose={()=>setShowLeave(false)} onSaved={load} />}
    </>
  );
}
