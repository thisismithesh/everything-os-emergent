import { useEffect, useMemo, useRef, useState } from "react";
import GanttTimeline from "@/components/GanttTimeline";
import { Link } from "react-router-dom";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";
import { Plus, Download, Search, LayoutGrid, List, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const TYPE_LABEL = {
  billable_regular: "Billable Project",
  billable_retainer: "Billable Account",
  non_billable: "Non-Billable Project",
};
const PROJECT_STATUSES = ["pitch", "upcoming", "ongoing", "complete", "hold", "cancelled"];
const PROJECT_HEALTHS = ["on_track", "at_risk", "off_track"];
const PROJECT_PRIORITIES = ["high", "medium", "low"];

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
            <option value="billable_regular">Billable Project</option>
            <option value="billable_retainer">Billable Account</option>
            <option value="non_billable">Non-Billable Project</option>
          </select>
          <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white" data-testid="projects-filter-status">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map(s=> <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
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
          <GanttTimeline
            rows={visible.filter((p)=>p.start_date && p.end_date).map((p) => ({
              id: p.id,
              label: p.name,
              sublabel: TYPE_LABEL[p.type],
              start: p.start_date,
              end: p.end_date,
              color: p.health === "on_track" ? "#0A0A0A" : p.health === "at_risk" ? "#F59E0B" : "#EF4444",
              onClick: () => window.location.assign(`/projects/${p.id}`),
            }))}
            onPatch={async (pid, { start, end }) => {
              const target = projects.find((x)=>x.id===pid);
              if (!target) return;
              const body = { ...target, start_date: start, end_date: end };
              delete body.id; delete body.share_token; delete body.public_enabled; delete body.created_at;
              await api.patch(`/projects/${pid}`, body).catch(()=>{});
              load();
            }}
            emptyMessage="Projects need start and end dates to appear in the Gantt."
          />
        )}
      </div>

      {showAdd && <AddProjectModal clients={clients} users={users} onClose={()=>setShowAdd(false)} onSaved={load} />}
    </>
  );
}

function AddProjectModal({ clients, users, onClose, onSaved, project }) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name || "");
  const [type, setType] = useState(project?.type || "billable_regular");
  const [status, setStatus] = useState(project?.status || "pitch");
  const [priority, setPriority] = useState(project?.priority || "medium");
  const [health, setHealth] = useState(project?.health || "on_track");
  const [clientId, setClientId] = useState(project?.client_id || "");
  const [start, setStart] = useState(project?.start_date || "");
  const [end, setEnd] = useState(project?.end_date || "");
  const [brief, setBrief] = useState(project?.brief || "");
  const [scope, setScope] = useState(project?.scope || "");
  const [leadSource, setLeadSource] = useState(project?.lead_source || "");
  const [hoursAllocated, setHoursAllocated] = useState(project?.hours_allocated || "");
  const [budget, setBudget] = useState(project?.budget ?? "");
  const [deliverables, setDeliverables] = useState((project?.service_deliverables || []).join(", "));
  const [members, setMembers] = useState(project?.members || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const memberObj = (uid) => members.find((m) => m.user_id === uid);
  const toggleMember = (uid) => setMembers((a) =>
    memberObj(uid) ? a.filter((m)=>m.user_id!==uid) : [...a, { user_id: uid, role: null }]);
  const setMemberRole = (uid, role) => setMembers((a) =>
    a.map((m) => m.user_id === uid ? { ...m, role } : m));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const payload = {
      name, type, status, priority, health,
      client_id: clientId || null,
      start_date: start || null, end_date: end || null,
      brief: brief || null, scope: scope || null,
      lead_source: leadSource || null,
      hours_allocated: hoursAllocated ? Number(hoursAllocated) : null,
      budget: budget === "" ? null : Number(budget),
      service_deliverables: deliverables ? deliverables.split(",").map((s)=>s.trim()).filter(Boolean) : [],
      members,
    };
    try {
      if (isEdit) await api.patch(`/projects/${project.id}`, payload);
      else await api.post("/projects", payload);
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="project-form-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{isEdit ? "Edit project" : "New project"}</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Project name" data-testid="project-name-input" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          <div className="grid grid-cols-3 gap-2">
            <select value={type} onChange={(e)=>setType(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-type-select">
              <option value="billable_regular">Billable Project</option>
              <option value="billable_retainer">Billable Account</option>
              <option value="non_billable">Non-Billable Project</option>
            </select>
            <select value={status} onChange={(e)=>setStatus(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-status-select">
              {PROJECT_STATUSES.map(s=> <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
            <select value={priority} onChange={(e)=>setPriority(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2">
              {PROJECT_PRIORITIES.map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={clientId} onChange={(e)=>setClientId(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-client-select">
              <option value="">No client (internal)</option>
              {clients.map((c)=> <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
            <select value={health} onChange={(e)=>setHealth(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2">
              {PROJECT_HEALTHS.map(s=> <option key={s} value={s}>{s.replace("_"," ")}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Start date</div>
              <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-start-input" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">End date</div>
              <input type="date" value={end} onChange={(e)=>setEnd(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-end-input" />
            </label>
          </div>
          <input value={leadSource} onChange={(e)=>setLeadSource(e.target.value)} placeholder="Lead source" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          {type === "billable_retainer" && (
            <input type="number" min="0" value={hoursAllocated} onChange={(e)=>setHoursAllocated(e.target.value)} placeholder="Hours allocated (per month)" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          )}
          {type !== "non_billable" && (
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Project budget (₹)</div>
              <input type="number" min="0" step="1000" value={budget} onChange={(e)=>setBudget(e.target.value)} placeholder="e.g. 500000" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-budget-input" />
            </label>
          )}
          <input value={deliverables} onChange={(e)=>setDeliverables(e.target.value)} placeholder="Deliverables (comma separated)" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="project-deliverables-input" />
          <textarea value={brief} onChange={(e)=>setBrief(e.target.value)} placeholder="Project brief\u2026" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 min-h-[64px]" />
          <textarea value={scope} onChange={(e)=>setScope(e.target.value)} placeholder="Project scope\u2026" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 min-h-[64px]" />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Team & roles</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {users.filter(u=>u.role!=="client").map((u) => {
                const m = memberObj(u.id);
                return (
                  <div key={u.id} className="flex items-center gap-2 p-2 rounded border border-[var(--border-subtle)] bg-white">
                    <input type="checkbox" checked={!!m} onChange={()=>toggleMember(u.id)} data-testid={`project-member-toggle-${u.id}`} />
                    <span className="text-sm flex-1 truncate">{u.name}</span>
                    {m && (
                      <select value={m.role || ""} onChange={(e)=>setMemberRole(u.id, e.target.value || null)} className="text-xs border border-[var(--border-default)] rounded px-2 py-1" data-testid={`project-member-role-${u.id}`}>
                        <option value="">— Role —</option>
                        <option value="Project Owner">Project Owner</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Designer">Designer</option>
                        <option value="Engineer">Engineer</option>
                        <option value="Strategist">Strategist</option>
                        <option value="Reviewer">Reviewer</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="project-save-btn">{busy?"Saving\u2026":(isEdit?"Save changes":"Create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { AddProjectModal };
