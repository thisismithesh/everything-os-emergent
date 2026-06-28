import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, Empty } from "@/components/ui-bits";
import { Download, Search, Plus, X, Pencil, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = () => Promise.all([
    api.get("/users").then((r)=>setUsers(r.data)),
    api.get("/tasks").then((r)=>setTasks(r.data)).catch(()=>setTasks([])),
    api.get("/leaves").then((r)=>setLeaves(r.data)).catch(()=>setLeaves([])),
    api.get("/projects").then((r)=>setProjects(r.data)).catch(()=>setProjects([])),
  ]);
  useEffect(() => { load(); }, []);

  const teamUsers = useMemo(()=> users.filter(u=>u.role!=="client"), [users]);
  const teamsList = useMemo(()=> [...new Set(teamUsers.map(u=>u.team).filter(Boolean))], [teamUsers]);
  const visible = useMemo(() => {
    return teamUsers.filter((u) => {
      if (search && !(u.name||"").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTeam && u.team !== filterTeam) return false;
      return true;
    });
  }, [teamUsers, search, filterTeam]);

  const projectsForUser = (uid) => projects.filter((p) => (p.members||[]).some((m)=>m.user_id===uid));
  const statsFor = (uid) => {
    const t = tasks.filter((x) => (x.assignees||[]).includes(uid));
    const open = t.filter((x) => x.status !== "done").length;
    const spent = t.reduce((acc, x) => acc + (x.time_spent || 0), 0);
    const l = leaves.filter((lv) => lv.user_id === uid);
    return { tasks: t.length, open, spent, leaves: l.length };
  };

  const canManage = user && (user.role === "leadership" || user.role === "manager");

  return (
    <>
      <PageHeader eyebrow="Team" title="Team database" description="Click a row to see details, leaves and projects.">
        <a href={`${process.env.REACT_APP_BACKEND_URL}/api/export/users.csv`} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2" data-testid="team-export-btn">
          <Download className="w-4 h-4" /> Export
        </a>
        {canManage && (
          <button onClick={()=>setShowAdd(true)} className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2" data-testid="team-add-btn">
            <Plus className="w-4 h-4" /> Member
          </button>
        )}
      </PageHeader>
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search team…"
              className="pl-9 pr-3 py-2 text-sm bg-white border border-[var(--border-default)] rounded-md w-64" data-testid="team-search-input" />
          </div>
          <select value={filterTeam} onChange={(e)=>setFilterTeam(e.target.value)} className="text-sm border border-[var(--border-default)] rounded-md px-3 py-2 bg-white" data-testid="team-filter-team">
            <option value="">All teams</option>
            {teamsList.map((t)=> <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {visible.length === 0 ? <Empty title="No team members" /> : (
          <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
                <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                  <th className="px-4 py-2">Member</th>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={()=>setSelected(u)} data-testid={`team-row-${u.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar user={u} size={32} />
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.team || "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.title || "—"}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-0.5 rounded-full ${u.in_office ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#DBEAFE] text-[#1E40AF]"}`}>{u.in_office ? "In office" : "Remote"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <MemberDrawer
          member={selected}
          projects={projectsForUser(selected.id)}
          leaves={leaves.filter((l)=>l.user_id===selected.id)}
          stats={statsFor(selected.id)}
          canManage={canManage}
          onClose={()=>setSelected(null)}
          onEdit={()=>{ setEditing(selected); setSelected(null); }}
        />
      )}
      {showAdd && <MemberFormModal onClose={()=>setShowAdd(false)} onSaved={load} />}
      {editing && <MemberFormModal member={editing} onClose={()=>setEditing(null)} onSaved={load} />}
    </>
  );
}

function MemberDrawer({ member, projects, leaves, stats, canManage, onClose, onEdit }) {
  const u = member;
  return (
    <div className="fixed inset-0 z-40" data-testid="team-member-drawer">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full md:w-[420px] bg-white border-l border-[var(--border-default)] shadow-xl overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-[var(--border-default)] px-5 py-4 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">Team member</div>
          <div className="flex items-center gap-1">
            {canManage && <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)]" data-testid="team-member-edit-btn" aria-label="Edit"><Pencil className="w-4 h-4" /></button>}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)]" aria-label="Close" data-testid="team-member-close-btn"><X className="w-4 h-4" /></button>
          </div>
        </header>
        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4">
            <Avatar user={u} size={56} />
            <div>
              <div className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{u.name}</div>
              <div className="text-xs text-[var(--text-secondary)]">{u.title || "—"}</div>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] mt-0.5">{u.role}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Tasks" value={stats.tasks} sub={`${stats.open} open`} />
            <Stat label="Hours logged" value={`${stats.spent}h`} />
          </div>

          <Section title="Details">
            <Row k="Team" v={u.team} />
            <Row k="Email" v={u.email} />
            <Row k="Status" v={u.in_office ? "In office" : "Remote"} />
            <Row k="Joined" v={u.joining_date} />
            <Row k="Birthday" v={u.birthday} />
            <Row k="Hourly rate" v={u.hourly_rate ? `₹${u.hourly_rate.toLocaleString("en-IN")}/h` : null} />
          </Section>

          <Section title={`Projects (${projects.length})`}>
            {projects.length === 0 ? <div className="text-xs text-[var(--text-tertiary)]">Not assigned to any projects.</div> : (
              <ul className="space-y-1 text-sm">
                {projects.map((p) => {
                  const m = (p.members||[]).find((x)=>x.user_id===u.id);
                  return <li key={p.id} className="flex items-center justify-between"><span>{p.name}</span><span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{m?.role || "—"}</span></li>;
                })}
              </ul>
            )}
          </Section>

          <Section title={`Leaves (${leaves.length})`}>
            {leaves.length === 0 ? <div className="text-xs text-[var(--text-tertiary)]">No leaves recorded.</div> : (
              <ul className="space-y-1 text-sm">
                {leaves.map((l, i) => <li key={i}>{l.start_date} → {l.end_date} <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">· {l.type}</span></li>)}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-[var(--bg-surface-hover)] rounded-md p-3">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="text-2xl font-black tracking-tight mt-1" style={{ fontFamily: "'Cabinet Grotesk'" }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2">{title}</div>
      {children}
    </div>
  );
}
function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1">
      <span className="text-[var(--text-tertiary)] text-xs uppercase tracking-widest font-semibold">{k}</span>
      <span className="text-[var(--text-primary)]">{v || "—"}</span>
    </div>
  );
}

function MemberFormModal({ member, onClose, onSaved }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    email: member?.email || "",
    password: "",
    name: member?.name || "",
    role: member?.role || "team",
    title: member?.title || "",
    team: member?.team || "Design",
    in_office: member?.in_office ?? true,
    joining_date: member?.joining_date || "",
    birthday: member?.birthday || "",
    avatar: member?.avatar || "",
    hourly_rate: member?.hourly_rate ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const upd = (k, v) => setForm((f)=>({ ...f, [k]: v }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const payload = { ...form, hourly_rate: form.hourly_rate === "" ? null : Number(form.hourly_rate) };
      if (isEdit) {
        const { password, email, ...rest } = payload;
        await api.patch(`/users/${member.id}`, rest);
      } else {
        await api.post("/auth/register", payload);
      }
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="team-member-form-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{isEdit ? "Edit team member" : "New team member"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-surface-hover)]" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <input required value={form.name} onChange={(e)=>upd("name",e.target.value)} placeholder="Full name" className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-name-input" />
            <input required={!isEdit} disabled={isEdit} value={form.email} type="email" onChange={(e)=>upd("email",e.target.value)} placeholder="Email" className="border border-[var(--border-default)] rounded-md px-3 py-2 disabled:bg-[var(--bg-surface-hover)]" data-testid="member-email-input" />
          </div>
          {!isEdit && (
            <input required value={form.password} type="password" onChange={(e)=>upd("password",e.target.value)} placeholder="Password" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-password-input" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <select value={form.role} onChange={(e)=>upd("role",e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-role-select">
              <option value="team">Team</option><option value="manager">Manager</option><option value="leadership">Leadership</option>
            </select>
            <input value={form.team} onChange={(e)=>upd("team",e.target.value)} placeholder="Team" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
          </div>
          <input value={form.title} onChange={(e)=>upd("title",e.target.value)} placeholder="Title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-title-input" />
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Hourly rate (₹/h)</div>
            <input type="number" min="0" step="50" value={form.hourly_rate} onChange={(e)=>upd("hourly_rate",e.target.value)} placeholder="e.g. 2500" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-rate-input" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Joined</div>
              <input type="date" value={form.joining_date} onChange={(e)=>upd("joining_date",e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Birthday</div>
              <input type="date" value={form.birthday} onChange={(e)=>upd("birthday",e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
            </label>
          </div>
          <input value={form.avatar} onChange={(e)=>upd("avatar",e.target.value)} placeholder="Avatar URL" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-avatar-input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.in_office} onChange={(e)=>upd("in_office",e.target.checked)} /> In-office
          </label>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="member-save-btn">{busy?"Saving…":(isEdit?"Save changes":"Create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
