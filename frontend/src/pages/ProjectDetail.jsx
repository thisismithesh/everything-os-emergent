import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";
import { Share2, Globe, Download, ArrowLeft, Pencil, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Comments from "@/components/Comments";
import TaskDetailDrawer from "@/components/TaskDetailDrawer";
import GanttTimeline from "@/components/GanttTimeline";
import { EventFormModal } from "@/pages/Calendar";
import { AddTaskModal } from "@/pages/Tasks";
import { AddProjectModal } from "@/pages/Projects";

const TYPE_LABEL = { billable_regular: "Billable Project", billable_retainer: "Billable Account", non_billable: "Non-Billable Project" };

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
  const [drawerTaskId, setDrawerTaskId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingProject, setEditingProject] = useState(false);
  const [clients, setClients] = useState([]);

  const updateTaskStatus = async (task, status) => {
    if (task.status === status) return;
    await api.patch(`/tasks/${task.id}`, { status }).catch(() => {});
    await load();
  };
  const patchTaskDates = async (task_id, patch) => {
    await api.patch(`/tasks/${task_id}`, patch).catch(() => {});
    await load();
  };

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
    const cs = await api.get("/clients").then((r)=>r.data).catch(()=>[]);
    setClients(cs);
    if (p.client_id) {
      const cs2 = await api.get("/clients").then((r)=>r.data).catch(()=>[]);
      setClient(cs2.find((c)=>c.id===p.client_id) || null);
    } else { setClient(null); }
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
            <button onClick={()=>setEditingProject(true)} className="px-3 py-2 text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] flex items-center gap-2" data-testid="project-edit-btn">
              <Pencil className="w-4 h-4" /> Edit
            </button>
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
              <div className="flex items-center gap-2">
                <a href={`${import.meta.env.VITE_BACKEND_URL}/api/export/tasks.csv`} className="text-sm flex items-center gap-2 px-3 py-2 border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-surface-hover)]"><Download className="w-4 h-4" /> Export</a>
                {canEdit && <button onClick={()=>setShowAddTask(true)} className="text-sm flex items-center gap-2 px-3 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)]" data-testid="project-add-task-btn"><Plus className="w-4 h-4" /> Task</button>}
              </div>
            </div>
            {tasks.length === 0 ? <Empty title="No tasks yet" /> : (
              taskView === "list" ? <TaskList tasks={tasks} userById={userById} onOpen={setDrawerTaskId} /> :
              taskView === "kanban" ? <TaskKanban tasks={tasks} userById={userById} onOpen={setDrawerTaskId} updateStatus={updateTaskStatus} /> :
              <GanttTimeline
                rows={(() => {
                  // Group tasks by category
                  const grouped = {};
                  tasks.filter((tk)=>tk.original_deadline || tk.latest_deadline).forEach((tk) => {
                    const cat = tk.category || "Uncategorized";
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(tk);
                  });
                  // Convert to rows with min/max dates per category
                  return Object.entries(grouped).map(([cat, catTasks]) => {
                    const allDates = catTasks.flatMap((t) => [t.original_deadline, t.latest_deadline].filter(Boolean));
                    const minDate = allDates.length > 0 ? allDates.reduce((a,b)=> a<b?a:b) : null;
                    const maxDate = allDates.length > 0 ? allDates.reduce((a,b)=> a>b?a:b) : null;
                    return {
                      id: cat,
                      label: cat,
                      sublabel: `${catTasks.length} task${catTasks.length !== 1 ? 's' : ''}`,
                      start: minDate || (catTasks[0]?.original_deadline || catTasks[0]?.latest_deadline),
                      end: maxDate || (catTasks[0]?.latest_deadline || catTasks[0]?.original_deadline),
                      color: "#2563EB",
                      secondary: catTasks.map((t) => ({
                        start: t.original_deadline || t.latest_deadline,
                        end: t.latest_deadline || t.original_deadline,
                        color: t.status === "done" ? "#10B981" : t.status === "blocked" ? "#EF4444" : "#6B7280",
                        title: t.name,
                      })),
                      onClick: () => {/* expand/collapse or show category details */},
                    };
                  });
                })()}
                onPatch={async (catId, { start, end }) => { 
                  // Find all tasks in this category and update their dates
                  const catTasks = tasks.filter((t) => (t.category || "Uncategorized") === catId);
                  for (const t of catTasks) {
                    await patchTaskDates(t.id, { original_deadline: start, latest_deadline: end });
                  }
                }}
                emptyMessage="Add deadlines to your tasks to see the Gantt view."
              />
            )}
          </>
        )}

        {tab === "calendar" && (
          <Section title={(
            <div className="flex items-center justify-between w-full">
              <span>Project events</span>
              {canEdit && <button onClick={()=>setShowAddEvent(true)} className="text-xs flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid="project-add-event-btn"><Plus className="w-3 h-3" /> Event</button>}
            </div>
          )}>
            {events.length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">No events scheduled.</span> : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {events.map((e) => (
                  <li key={e.id} className="py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-surface-hover)] -mx-3 px-3 rounded" onClick={()=>setEditingEvent(e)} data-testid={`project-event-${e.id}`}>
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
          <>
            <Section title="Project team">
              {team.length === 0 ? <span className="text-sm text-[var(--text-tertiary)]">No team yet.</span> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {team.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 border border-[var(--border-default)] rounded-md bg-white" data-testid={`project-team-member-${m.id}`}>
                      <Avatar user={m} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] truncate">{m.role || m.title}</div>
                      </div>
                      {(m.role === "Project Owner" || m.role === "Project Manager") && (
                        <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-[var(--brand)] text-white">{m.role === "Project Owner" ? "Owner" : "PM"}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
            {(() => {
              const clientUsers = users.filter((u) => u.role === "client" && project.client_id && u.client_id === project.client_id);
              if (clientUsers.length === 0) return null;
              return (
                <Section title="Client contacts">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {clientUsers.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 p-3 border border-[var(--border-default)] rounded-md bg-white" data-testid={`project-client-user-${m.id}`}>
                        <Avatar user={m} size={40} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{m.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] truncate">{m.title || client?.company || "Client"}</div>
                        </div>
                        <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">Client</span>
                      </div>
                    ))}
                  </div>
                </Section>
              );
            })()}
          </>
        )}
      </div>

      {drawerTaskId && <TaskDetailDrawer taskId={drawerTaskId} users={users} onClose={()=>setDrawerTaskId(null)} onChanged={load} />}
      {showAddTask && <AddTaskModal projects={[project]} users={users} onClose={()=>setShowAddTask(false)} onSaved={load} defaultProjectId={project.id} hideProjectSelect />}
      {showAddEvent && <EventFormModal users={users} projectId={project.id} onClose={()=>setShowAddEvent(false)} onSaved={load} canEdit={canEdit} />}
      {editingEvent && <EventFormModal event={editingEvent} users={users} onClose={()=>setEditingEvent(null)} onSaved={load} canEdit={canEdit} />}
      {editingProject && <AddProjectModal project={project} clients={clients} users={users} onClose={()=>setEditingProject(false)} onSaved={load} />}
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

function TaskList({ tasks, userById, onOpen }) {
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
            <tr key={t.id} className="border-b border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-surface-hover)]" onClick={()=>onOpen && onOpen(t.id)} data-testid={`pd-task-row-${t.id}`}>
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

function TaskKanban({ tasks, userById, onOpen, updateStatus }) {
  const cols = ["todo","in_progress","review","blocked","done"];
  const labels = { todo: "To do", in_progress: "In progress", review: "In review", blocked: "Blocked", done: "Done" };
  const [dragOver, setDragOver] = useState(null);
  const onDragStart = (e, t) => { e.dataTransfer.setData("text/task-id", t.id); e.dataTransfer.effectAllowed = "move"; };
  const onDrop = async (e, col) => {
    e.preventDefault(); setDragOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    const task = tasks.find((x) => x.id === id);
    if (task && task.status !== col) await updateStatus(task, col);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3" data-testid="pd-tasks-kanban">
      {cols.map((c) => (
        <div key={c} className={`kanban-col rounded-md p-2 min-h-[260px] transition-colors ${dragOver===c ? "ring-2 ring-[var(--brand)] ring-offset-2" : ""}`}
          data-testid={`pd-kanban-col-${c}`}
          onDragOver={(e)=>{ e.preventDefault(); setDragOver(c); }}
          onDragLeave={()=> setDragOver((cur)=> cur===c ? null : cur)}
          onDrop={(e)=> onDrop(e, c)}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{labels[c]}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{tasks.filter((t)=>t.status===c).length}</div>
          </div>
          <div className="space-y-2">
            {tasks.filter((t)=>t.status===c).map((t) => (
              <div key={t.id} draggable onDragStart={(e)=>onDragStart(e,t)} onClick={()=>onOpen && onOpen(t.id)}
                className="bg-white border border-[var(--border-default)] rounded-md p-3 cursor-grab active:cursor-grabbing"
                data-testid={`pd-kanban-card-${t.id}`}>
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