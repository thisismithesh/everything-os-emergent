import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill, Empty } from "@/components/ui-bits";
import { Plus, Download, Search, ChevronRight, ChevronDown } from "lucide-react";

const STATUSES = ["todo", "in_progress", "review", "blocked", "done"];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list"); // list | kanban
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = () =>
    Promise.all([
      api.get("/tasks").then((r) => setTasks(r.data)).catch(() => setTasks([])),
      api.get("/projects").then((r) => setProjects(r.data)).catch(() => setProjects([])),
      api.get("/users").then((r) => setUsers(r.data)).catch(() => setUsers([])),
    ]);

  useEffect(() => { load(); }, []);

  const userById = useMemo(() => { const m = {}; users.forEach((u) => (m[u.id] = u)); return m; }, [users]);
  const projectById = useMemo(() => { const m = {}; projects.forEach((p) => (m[p.id] = p)); return m; }, [projects]);

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      if (filterProject && t.project_id !== filterProject) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterAssignee && !(t.assignees || []).includes(filterAssignee)) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterProject, filterStatus, filterAssignee, search]);

  const parentTasks = visible.filter((t) => !t.parent_task_id);
  const childrenOf = (id) => visible.filter((t) => t.parent_task_id === id);

  const updateStatus = async (task, status) => {
    await api.patch(`/tasks/${task.id}`, { status });
    load();
  };

  return (
    <>
      <PageHeader eyebrow="Tasks" title="All tasks" description="Track work across all projects, subtasks and recurring tasks.">
        <div className="flex items-center bg-white border border-[var(--border-default)] rounded-md overflow-hidden" data-testid="task-view-toggle">
          <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs font-semibold ${view==="list"?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} data-testid="tasks-view-list">List</button>
          <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs font-semibold ${view==="kanban"?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} data-testid="tasks-view-kanban">Kanban</button>
        </div>
        <a href={`${process.env.REACT_APP_BACKEND_URL}/api/export/tasks.csv`} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2" data-testid="tasks-export-btn">
          <Download className="w-4 h-4" /> Export
        </a>
        <button onClick={() => setShowAdd(true)} className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2" data-testid="tasks-add-btn">
          <Plus className="w-4 h-4" /> Task
        </button>
      </PageHeader>

      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks…"
              data-testid="tasks-search-input"
              className="pl-9 pr-3 py-2 text-sm bg-white border border-[var(--border-default)] rounded-md w-64 focus:ring-2 focus:ring-[var(--brand)]" />
          </div>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} data-testid="tasks-filter-project"
            className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="tasks-filter-status"
            className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white">
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} data-testid="tasks-filter-assignee"
            className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white">
            <option value="">All assignees</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {view === "list" ? (
          parentTasks.length === 0 ? (
            <Empty title="No tasks match" hint="Try adjusting your filters or add a new task." />
          ) : (
            <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
                  <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2">Task</th>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Assignees</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Est.</th>
                    <th className="px-4 py-2 text-right">Spent</th>
                    <th className="px-4 py-2">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {parentTasks.map((t) => {
                    const subs = childrenOf(t.id);
                    const open = !!expanded[t.id];
                    return (
                      <FragmentRow key={t.id} task={t} subs={subs} open={open} setOpen={() => setExpanded((x) => ({...x, [t.id]: !x[t.id]}))}
                        projectById={projectById} userById={userById} updateStatus={updateStatus} />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <Kanban tasks={visible} userById={userById} projectById={projectById} updateStatus={updateStatus} />
        )}
      </div>

      {showAdd && <AddTaskModal projects={projects} users={users} onClose={() => setShowAdd(false)} onSaved={load} />}
    </>
  );
}

function FragmentRow({ task, subs, open, setOpen, projectById, userById, updateStatus }) {
  const t = task;
  const assignees = (t.assignees || []).map((id) => userById[id]).filter(Boolean);
  const p = t.project_id ? projectById[t.project_id] : null;
  return (
    <>
      <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`task-row-${t.id}`}>
        <td className="px-4 py-3 w-8">
          {subs.length > 0 ? (
            <button onClick={setOpen} data-testid={`task-expand-${t.id}`}>
              {open ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />}
            </button>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-[var(--text-primary)]">{t.name}</div>
          {t.is_recurring && <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Recurring · {t.recurrence_rule}</div>}
        </td>
        <td className="px-4 py-3 text-[var(--text-secondary)]">{p?.name || <span className="text-[var(--text-tertiary)]">—</span>}</td>
        <td className="px-4 py-3"><AvatarStack users={assignees} /></td>
        <td className="px-4 py-3">
          <select value={t.status} onChange={(e) => updateStatus(t, e.target.value)} data-testid={`task-status-${t.id}`}
            className="bg-transparent text-xs font-medium border-0 focus:ring-1 focus:ring-[var(--brand)] rounded">
            {["todo","in_progress","review","blocked","done"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{t.estimated_hours ?? "—"}h</td>
        <td className="px-4 py-3 text-right tabular-nums text-[var(--text-secondary)]">{t.time_spent ?? 0}h</td>
        <td className="px-4 py-3 text-[var(--text-secondary)]">{t.latest_deadline || "—"}</td>
      </tr>
      {open && subs.map((s) => (
        <tr key={s.id} className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-hover)]/30">
          <td></td>
          <td className="px-4 py-2 pl-10 text-sm text-[var(--text-secondary)]">↳ {s.name}</td>
          <td></td>
          <td className="px-4 py-2"><AvatarStack users={(s.assignees||[]).map(id=>userById[id]).filter(Boolean)} /></td>
          <td className="px-4 py-2"><StatusPill status={s.status} /></td>
          <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{s.estimated_hours ?? "—"}h</td>
          <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{s.time_spent ?? 0}h</td>
          <td className="px-4 py-2 text-[var(--text-secondary)]">{s.latest_deadline || "—"}</td>
        </tr>
      ))}
    </>
  );
}

function Kanban({ tasks, userById, projectById, updateStatus }) {
  const cols = ["todo","in_progress","review","blocked","done"];
  const labels = { todo: "To do", in_progress: "In progress", review: "In review", blocked: "Blocked", done: "Done" };
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3" data-testid="tasks-kanban">
      {cols.map((c) => (
        <div key={c} className="kanban-col rounded-md p-2 min-h-[300px]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{labels[c]}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{tasks.filter((t)=>t.status===c).length}</div>
          </div>
          <div className="space-y-2">
            {tasks.filter((t)=>t.status===c).map((t) => {
              const assignees = (t.assignees||[]).map((id)=>userById[id]).filter(Boolean);
              const p = t.project_id ? projectById[t.project_id] : null;
              return (
                <div key={t.id} data-testid={`kanban-card-${t.id}`} className="bg-white border border-[var(--border-default)] rounded-md p-3 hover:shadow-sm transition-shadow">
                  <div className="text-sm font-medium text-[var(--text-primary)] leading-tight">{t.name}</div>
                  {p && <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] mt-1.5">{p.name}</div>}
                  <div className="flex items-center justify-between mt-3">
                    <AvatarStack users={assignees} size={20} />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-tertiary)]">{t.latest_deadline || "—"}</span>
                      <select value={t.status} onChange={(e)=>updateStatus(t,e.target.value)} className="text-[10px] bg-transparent">
                        {cols.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AddTaskModal({ projects, users, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState("todo");
  const [estimate, setEstimate] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [assignees, setAssignees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.post("/tasks", {
        name, project_id: projectId || null, status,
        estimated_hours: Number(estimate) || 0,
        original_deadline: deadline || null, latest_deadline: deadline || null,
        assignees,
      });
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const toggle = (id) => setAssignees((a)=> a.includes(id) ? a.filter(x=>x!==id) : [...a,id]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>New task</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Task name" data-testid="task-name-input"
            className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <select value={projectId} onChange={(e)=>setProjectId(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="task-project-select">
              <option value="">No project (recurring)</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="task-status-select">
              {["todo","in_progress","review","blocked","done"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="0" value={estimate} onChange={(e)=>setEstimate(e.target.value)} placeholder="Estimated hours" className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="task-estimate-input" />
            <input type="date" value={deadline} onChange={(e)=>setDeadline(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="task-deadline-input" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Assignees</div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {users.map((u) => (
                <button key={u.id} type="button" onClick={()=>toggle(u.id)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${assignees.includes(u.id) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--text-secondary)] border-[var(--border-default)]"}`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="task-save-btn">{busy?"Saving…":"Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
