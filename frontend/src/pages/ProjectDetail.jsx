import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";
import { Share2, Globe, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const TYPE_LABEL = { billable_regular: "Billable", billable_retainer: "Retainer", non_billable: "Non-billable" };

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState("overview");
  const [taskView, setTaskView] = useState("list");
  const [shareCopied, setShareCopied] = useState(false);

  const load = async () => {
    const p = await api.get(`/projects/${id}`).then((r)=>r.data);
    setProject(p);
    try {
      const t = await api.get(`/tasks?project_id=${id}`).then((r)=>r.data);
      setTasks(t);
    } catch { setTasks([]); }
    const all = await api.get("/events").then((r)=>r.data).catch(()=>[]);
    setEvents(all.filter((e)=>e.project_id === id));
    const us = await api.get("/users").then((r)=>r.data).catch(()=>[]);
    setUsers(us);
    if (p.client_id) {
      try {
        const cs = await api.get("/clients").then((r)=>r.data);
        setClient(cs.find((c)=>c.id===p.client_id) || null);
      } catch { setClient(null); }
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const userById = useMemo(() => { const m={}; users.forEach(u=>m[u.id]=u); return m; }, [users]);

  if (!project) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading…</div>;

  const team = (project.members||[]).map((m)=>({ ...userById[m.user_id], role: m.role })).filter((u)=>u.id);
  const canEdit = user && (user.role === "leadership" || user.role === "manager");

  const togglePublic = async () => {
    const { data } = await api.post(`/projects/${id}/toggle-public`);
    setProject((p) => ({ ...p, public_enabled: data.public_enabled, share_token: data.share_token }));
  };
  const copyShare = async () => {
    const url = `${window.location.origin}/public/projects/${project.share_token}`;
    try { await navigator.clipboard.writeText(url); setShareCopied(true); setTimeout(()=>setShareCopied(false),2000); } catch {}
  };

  return (
    <>
      <PageHeader
        eyebrow={`${TYPE_LABEL[project.type]}${client ? " · " + client.company : ""}`}
        title={project.name}
        description={project.brief}
      >
        <Link to="/projects" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1" data-testid="project-back-link"><ArrowLeft className="w-4 h-4" /> All projects</Link>
        {canEdit && (
          <>
            <button onClick={togglePublic} className="px-3 py-2 text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2" data-testid="project-toggle-public">
              <Globe className="w-4 h-4" /> {project.public_enabled ? "Public" : "Private"}
            </button>
            {project.public_enabled && (
              <button onClick={copyShare} className="px-3 py-2 text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2" data-testid="project-copy-share">
                <Share2 className="w-4 h-4" /> {shareCopied ? "Copied!" : "Copy link"}
              </button>
            )}
          </>
        )}
      </PageHeader>

      <div className="p-8 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Status" value={<StatusPill status={project.status} />} />
          <Kpi label="Priority" value={<PriorityPill priority={project.priority} />} />
          <Kpi label="Health" value={<HealthDot health={project.health} />} />
          <Kpi label="Tasks" value={`${tasks.filter(t=>t.status==="done").length} / ${tasks.length}`} sub="completed" />
        </div>

        <div className="flex gap-2 border-b border-[var(--border-default)]">
          {[["overview","Overview"],["tasks","Tasks"],["calendar","Calendar"],["team","Team"]].map(([k,l]) => (
            <button key={k} onClick={()=>setTab(k)} data-testid={`project-tab-${k}`}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===k ? "border-[var(--brand)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Section title="Brief">{project.brief ? <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{project.brief}</p> : <span className="text-sm text-[var(--text-tertiary)]">No brief yet.</span>}</Section>
              <Section title="Scope">{project.scope ? <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{project.scope}</p> : <span className="text-sm text-[var(--text-tertiary)]">No scope yet.</span>}</Section>
              <Section title="Service / Deliverables">
                {(project.service_deliverables||[]).length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">—</span> : (
                  <div className="flex flex-wrap gap-1.5">
                    {project.service_deliverables.map((s)=> <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-default)]">{s}</span>)}
                  </div>
                )}
              </Section>
            </div>
            <div className="space-y-4">
              <Section title="Details">
                <dl className="text-sm space-y-2">
                  <Row k="Lead source" v={project.lead_source} />
                  <Row k="Start date" v={project.start_date} />
                  <Row k="End date" v={project.end_date} />
                  {project.type === "billable_retainer" && <Row k="Hours allocated" v={project.hours_allocated ? `${project.hours_allocated}h / month` : "—"} />}
                  {client && <Row k="Client" v={client.company} />}
                </dl>
              </Section>
              <Section title="Team">
                {team.length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">No team assigned yet.</span> : (
                  <ul className="space-y-2">
                    {team.map((m) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <Avatar user={m} size={32} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)]">{m.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{m.role || m.title}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
                {["list","kanban","gantt"].map((v) => (
                  <button key={v} onClick={()=>setTaskView(v)} className={`px-3 py-1.5 text-xs font-semibold capitalize ${taskView===v?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} data-testid={`project-tasks-view-${v}`}>{v}</button>
                ))}
              </div>
              <a href={`${process.env.REACT_APP_BACKEND_URL}/api/export/tasks.csv`} className="text-sm flex items-center gap-2 px-3 py-2 border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-surface-hover)]"><Download className="w-4 h-4" /> Export</a>
            </div>
            {tasks.length === 0 ? <Empty title="No tasks yet" /> : (
              taskView === "list" ? <TaskList tasks={tasks} userById={userById} /> :
              taskView === "kanban" ? <TaskKanban tasks={tasks} userById={userById} /> :
              <TaskGantt tasks={tasks} />
            )}
          </>
        )}

        {tab === "calendar" && (
          <Section title="Project events">
            {events.length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">No events scheduled.</span> : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {events.map((e) => (
                  <li key={e.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{e.name}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{e.date} · {e.time || "—"} → {e.end_time || "—"} · {e.location || "—"}</div>
                    </div>
                    <AvatarStack users={(e.attendees||[]).map((id)=>userById[id]).filter(Boolean)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === "team" && (
          <Section title="Project team">
            {team.length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">No team yet.</span> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {team.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 border border-[var(--border-default)] rounded-md bg-white">
                    <Avatar user={m} size={40} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] truncate">{m.role || m.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-4">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="mt-1 text-base font-bold flex items-center">{value}</div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-5">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--text-tertiary)] text-xs uppercase tracking-widest font-semibold">{k}</dt>
      <dd className="text-[var(--text-primary)] text-sm">{v || "—"}</dd>
    </div>
  );
}

function TaskList({ tasks, userById }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
          <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
            <th className="px-4 py-2">Task</th>
            <th className="px-4 py-2">Assignees</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right">Est.</th>
            <th className="px-4 py-2 text-right">Spent</th>
            <th className="px-4 py-2">Deadline</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t)=> (
            <tr key={t.id} className="border-b border-[var(--border-subtle)]">
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3"><AvatarStack users={(t.assignees||[]).map(id=>userById[id]).filter(Boolean)} /></td>
              <td className="px-4 py-3"><StatusPill status={t.status} /></td>
              <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{t.estimated_hours ?? "—"}h</td>
              <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{t.time_spent ?? 0}h</td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{t.latest_deadline || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskKanban({ tasks, userById }) {
  const cols = ["todo","in_progress","review","blocked","done"];
  const labels = { todo: "To do", in_progress: "In progress", review: "In review", blocked: "Blocked", done: "Done" };
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
      {cols.map((c) => (
        <div key={c} className="kanban-col rounded-md p-2 min-h-[260px]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{labels[c]}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{tasks.filter((t)=>t.status===c).length}</div>
          </div>
          <div className="space-y-2">
            {tasks.filter((t)=>t.status===c).map((t) => (
              <div key={t.id} className="bg-white border border-[var(--border-default)] rounded-md p-3">
                <div className="text-sm font-medium leading-tight">{t.name}</div>
                <div className="flex items-center justify-between mt-3">
                  <AvatarStack users={(t.assignees||[]).map(id=>userById[id]).filter(Boolean)} size={20} />
                  <span className="text-[10px] text-[var(--text-tertiary)]">{t.latest_deadline || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskGantt({ tasks }) {
  const dates = useMemo(() => {
    const all = tasks.flatMap((t) => [t.original_deadline, t.latest_deadline].filter(Boolean));
    if (all.length === 0) return [];
    const min = new Date(all.reduce((a,b)=> a<b?a:b)); min.setDate(min.getDate()-7);
    const max = new Date(all.reduce((a,b)=> a>b?a:b)); max.setDate(max.getDate()+7);
    const out = []; for (let d=new Date(min); d<=max; d.setDate(d.getDate()+1)) out.push(new Date(d));
    return out;
  }, [tasks]);
  if (dates.length === 0) return <Empty title="No deadlines" hint="Add deadlines to your tasks to see the Gantt view." />;
  const colW = 18;
  const start = dates[0];
  const idx = (iso) => Math.round((new Date(iso) - start) / (1000*60*60*24));
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md overflow-x-auto">
      <div className="min-w-fit">
        <div className="flex sticky top-0 bg-white z-10 border-b border-[var(--border-default)]">
          <div className="w-56 shrink-0 px-4 py-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold border-r border-[var(--border-default)]">Task</div>
          <div className="flex">
            {dates.map((d,i)=>(
              <div key={i} className="text-[10px] text-[var(--text-tertiary)] text-center border-r border-[var(--border-subtle)] py-2" style={{ width: colW }}>
                {d.getDate() === 1 || i===0 ? d.toLocaleDateString(undefined, { month:"short" }) : (d.getDay()===1 ? d.getDate() : "")}
              </div>
            ))}
          </div>
        </div>
        {tasks.map((t) => {
          const s = t.original_deadline ? idx(t.original_deadline) - 3 : 0;
          const e = t.latest_deadline ? idx(t.latest_deadline) : s + 3;
          const left = Math.max(0, s); const w = Math.max(1, (e - left + 1)) * colW;
          return (
            <div key={t.id} className="flex items-center border-b border-[var(--border-subtle)]">
              <div className="w-56 shrink-0 px-4 py-2 border-r border-[var(--border-default)] text-sm font-medium">{t.name}</div>
              <div className="relative" style={{ width: dates.length * colW, height: 30 }}>
                <div className="absolute top-1/2 -translate-y-1/2 rounded-sm" style={{ left: left*colW, width: w, height: 14, background: t.status === "done" ? "#10B981" : "#0A0A0A" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
