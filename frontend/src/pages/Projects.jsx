import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";
import { Plus, Download, Search, LayoutGrid, List, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const TYPE_LABEL = {
  billable_regular: "Billable",
  billable_retainer: "Retainer",
  non_billable: "Non-billable",
};

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [view, setView] = useState("grid"); // grid | list | gantt
  const [showAdd, setShowAdd] = useState(false);

  const load = () => Promise.all([
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => setProjects([])),
    api.get("/clients").then((r) => setClients(r.data)).catch(() => setClients([])),
    api.get("/users").then((r) => setUsers(r.data)).catch(() => setUsers([])),
  ]);
  useEffect(() => { load(); }, []);

  const clientById = useMemo(() => { const m = {}; clients.forEach((c)=>m[c.id]=c); return m; }, [clients]);
  const userById = useMemo(() => { const m = {}; users.forEach((u)=>m[u.id]=u); return m; }, [users]);

  const visible = useMemo(() => {
    return projects.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType && p.type !== filterType) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [projects, search, filterType, filterStatus]);

  const canCreate = user && (user.role === "leadership" || user.role === "manager");

  return (
    <>
      <PageHeader eyebrow="Projects" title="Projects" description="Active engagements, retainers and internal work.">
        <div className="flex items-center bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
          <button onClick={()=>setView("grid")} className={`px-3 py-1.5 ${view==="grid"?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} title="Grid" data-testid="projects-view-grid"><LayoutGrid className="w-4 h-4" /></button>
          <button onClick={()=>setView("list")} className={`px-3 py-1.5 ${view==="list"?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} title="List" data-testid="projects-view-list"><List className="w-4 h-4" /></button>
          <button onClick={()=>setView("gantt")} className={`px-3 py-1.5 ${view==="gantt"?"bg-[var(--brand)] text-white":"text-[var(--text-secondary)]"}`} title="Gantt" data-testid="projects-view-gantt"><CalendarIcon className="w-4 h-4" /></button>
        </div>
        <a href={`${process.env.REACT_APP_BACKEND_URL}/api/export/projects.csv`} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2" data-testid="projects-export-btn">
          <Download className="w-4 h-4" /> Export
        </a>
        {canCreate && (
          <button onClick={()=>setShowAdd(true)} className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2" data-testid="projects-add-btn">
            <Plus className="w-4 h-4" /> Project
          </button>
        )}
      </PageHeader>

      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search projects…" className="pl-9 pr-3 py-2 text-sm bg-white border border-[var(--border-default)] rounded-md w-64" data-testid="projects-search-input" />
          </div>
          <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white" data-testid="projects-filter-type">
            <option value="">All types</option>
            <option value="billable_regular">Billable</option>
            <option value="billable_retainer">Retainer</option>
            <option value="non_billable">Non-billable</option>
          </select>
          <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white" data-testid="projects-filter-status">
            <option value="">All statuses</option>
            {["planning","in_progress","review","on_hold","completed"].map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {visible.length === 0 ? (
          <Empty title="No projects yet" hint="Create your first project to get started." />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((p) => {
              const cl = p.client_id ? clientById[p.client_id] : null;
              const team = (p.members||[]).map((m)=>userById[m.user_id]).filter(Boolean);
              return (
                <Link key={p.id} to={`/projects/${p.id}`} data-testid={`project-card-${p.id}`}
                  className="block bg-white border border-[var(--border-default)] rounded-md p-5 hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{TYPE_LABEL[p.type]}{cl ? ` · ${cl.company}` : ""}</div>
                      <div className="text-lg font-bold tracking-tight mt-0.5" style={{ fontFamily: "'Cabinet Grotesk'" }}>{p.name}</div>
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <HealthDot health={p.health} />
                    <PriorityPill priority={p.priority} />
                  </div>
                  <div className="flex items-end justify-between mt-5">
                    <AvatarStack users={team} />
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
                      {p.start_date ? p.start_date.slice(5) : "—"} → {p.end_date ? p.end_date.slice(5) : "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : view === "list" ? (
          <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)]">
                <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold text-left">
                  <th className="px-4 py-2">Project</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Health</th>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const cl = p.client_id ? clientById[p.client_id] : null;
                  const team = (p.members||[]).map((m)=>userById[m.user_id]).filter(Boolean);
                  return (
                    <tr key={p.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]">
                      <td className="px-4 py-3">
                        <Link to={`/projects/${p.id}`} className="font-medium text-[var(--text-primary)] hover:underline" data-testid={`project-link-${p.id}`}>{p.name}</Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{TYPE_LABEL[p.type]}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{cl?.company || "—"}</td>
                      <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                      <td className="px-4 py-3"><PriorityPill priority={p.priority} /></td>
                      <td className="px-4 py-3"><HealthDot health={p.health} /></td>
                      <td className="px-4 py-3"><AvatarStack users={team} /></td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{p.start_date || "—"} → {p.end_date || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <GanttView projects={visible} onPatch={async (pid, patch)=>{
            const target = projects.find((x)=>x.id===pid);
            if (!target) return;
            const body = { ...target, ...patch };
            // strip server-side fields
            delete body.id; delete body.share_token; delete body.public_enabled; delete body.created_at;
            await api.patch(`/projects/${pid}`, body).catch(()=>{});
            load();
          }} />
        )}
      </div>

      {showAdd && <AddProjectModal clients={clients} users={users} onClose={()=>setShowAdd(false)} onSaved={load} />}
    </>
  );
}

function GanttView({ projects, onPatch }) {
  // Build a date range across all projects
  const dates = useMemo(() => {
    const all = projects.flatMap((p) => [p.start_date, p.end_date].filter(Boolean));
    if (all.length === 0) return [];
    const min = new Date(all.reduce((a, b) => a < b ? a : b));
    const max = new Date(all.reduce((a, b) => a > b ? a : b));
    min.setDate(min.getDate() - 5);
    max.setDate(max.getDate() + 5);
    const days = [];
    for (let d = new Date(min); d <= max; d.setDate(d.getDate()+1)) days.push(new Date(d));
    return days;
  }, [projects]);

  if (dates.length === 0) return <Empty title="No timeline data" hint="Projects need start and end dates to appear in the Gantt." />;

  const colW = 18;
  const start = dates[0];
  const idx = (iso) => {
    const d = new Date(iso);
    return Math.round((d - start) / (1000*60*60*24));
  };
  const dateAt = (i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d.toISOString().slice(0,10); };

  // Tick every 7 days
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md overflow-x-auto">
      <div className="min-w-fit">
        <div className="flex sticky top-0 bg-white z-10 border-b border-[var(--border-default)]">
          <div className="w-64 shrink-0 px-4 py-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold border-r border-[var(--border-default)]">Project</div>
          <div className="flex">
            {dates.map((d, i) => (
              <div key={i} className="text-[10px] text-[var(--text-tertiary)] text-center border-r border-[var(--border-subtle)] py-2" style={{ width: colW }}>
                {d.getDate() === 1 || i === 0 ? d.toLocaleDateString(undefined, { month: "short" }) : (d.getDay() === 1 ? d.getDate() : "")}
              </div>
            ))}
          </div>
        </div>
        {projects.map((p) => {
          if (!p.start_date || !p.end_date) return null;
          const s = idx(p.start_date);
          const e = idx(p.end_date);
          const w = Math.max(1, (e - s + 1));
          return (
            <ProjectGanttRow key={p.id} project={p} colW={colW} totalCols={dates.length} left={s} width={w} dateAt={dateAt} onPatch={onPatch} />
          );
        })}
      </div>
    </div>
  );
}

function ProjectGanttRow({ project, colW, totalCols, left, width, dateAt, onPatch }) {
  const [lp, setLp] = useState(left);
  const [wd, setWd] = useState(width);
  const lpRef = useRef(left);
  const wdRef = useRef(width);
  const drag = useRef(null);

  useEffect(() => { setLp(left); setWd(width); lpRef.current = left; wdRef.current = width; }, [left, width]);

  const onMouseDownMove = (e) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { mode: "move", startX: e.clientX, l0: lpRef.current, w0: wdRef.current };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onMouseDownResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    drag.current = { mode: "resize", startX: e.clientX, l0: lpRef.current, w0: wdRef.current };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const cells = Math.round(dx / colW);
    if (drag.current.mode === "move") {
      const next = Math.max(0, Math.min(totalCols - drag.current.w0, drag.current.l0 + cells));
      lpRef.current = next; setLp(next);
    } else {
      const next = Math.max(1, Math.min(totalCols - drag.current.l0, drag.current.w0 + cells));
      wdRef.current = next; setWd(next);
    }
  };
  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!drag.current) return;
    const mode = drag.current.mode;
    drag.current = null;
    const newStart = dateAt(lpRef.current);
    const newEnd = dateAt(lpRef.current + wdRef.current - 1);
    if (mode === "move") {
      await onPatch(project.id, { start_date: newStart, end_date: newEnd });
    } else {
      await onPatch(project.id, { end_date: newEnd });
    }
  };

  return (
    <div className="flex items-center border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]">
      <div className="w-64 shrink-0 px-4 py-3 border-r border-[var(--border-default)]">
        <Link to={`/projects/${project.id}`} className="text-sm font-medium hover:underline">{project.name}</Link>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mt-0.5">{TYPE_LABEL[project.type]}</div>
      </div>
      <div className="relative" style={{ width: totalCols * colW, height: 36 }} data-testid={`proj-gantt-track-${project.id}`}>
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-sm bg-[var(--accent)]"
          style={{ left: lp*colW, width: wd*colW, height: 18, cursor: "grab" }}
          onMouseDown={onMouseDownMove}
          data-testid={`proj-gantt-bar-${project.id}`}
        >
          <div
            onMouseDown={onMouseDownResize}
            className="absolute right-0 top-0 bottom-0 w-2 rounded-r-sm bg-white/40 hover:bg-white/70"
            style={{ cursor: "ew-resize" }}
            data-testid={`proj-gantt-resize-${project.id}`}
          />
        </div>
      </div>
    </div>
  );
}

function AddProjectModal({ clients, users, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("billable_regular");
  const [status, setStatus] = useState("planning");
  const [priority, setPriority] = useState("medium");
  const [health, setHealth] = useState("on_track");
  const [clientId, setClientId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [brief, setBrief] = useState("");
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (id) => setMembers((a)=> a.find(m=>m.user_id===id) ? a.filter(m=>m.user_id!==id) : [...a, { user_id: id }]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.post("/projects", { name, type, status, priority, health, client_id: clientId||null, start_date: start||null, end_date: end||null, brief, members });
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-xl p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>New project</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Project name" data-testid="project-name-input" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          <div className="grid grid-cols-3 gap-2">
            <select value={type} onChange={(e)=>setType(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-type-select">
              <option value="billable_regular">Billable</option>
              <option value="billable_retainer">Retainer</option>
              <option value="non_billable">Non-billable</option>
            </select>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2">
              {["planning","in_progress","review","on_hold","completed"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={priority} onChange={(e)=>setPriority(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2">
              {["high","medium","low"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={clientId} onChange={(e)=>setClientId(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-client-select">
              <option value="">No client (internal)</option>
              {clients.map((c)=> <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
            <select value={health} onChange={(e)=>setHealth(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2">
              {["on_track","at_risk","off_track"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-start-input" />
            <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-end-input" />
          </div>
          <textarea value={brief} onChange={(e)=>setBrief(e.target.value)} placeholder="Project brief…" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 min-h-[80px]" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Team</div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {users.filter(u=>u.role!=="client").map((u) => (
                <button key={u.id} type="button" onClick={()=>toggle(u.id)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${members.find(m=>m.user_id===u.id) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--text-secondary)] border-[var(--border-default)]"}`}>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="project-save-btn">{busy?"Saving…":"Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
