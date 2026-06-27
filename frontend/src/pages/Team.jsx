import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, AvatarStack, Empty } from "@/components/ui-bits";
import { Download, Search, Plus } from "lucide-react";
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

  const projectsByUser = useMemo(() => {
    const m = {};
    for (const p of projects) {
      for (const mem of p.members || []) {
        if (!m[mem.user_id]) m[mem.user_id] = [];
        m[mem.user_id].push(p);
      }
    }
    return m;
  }, [projects]);

  const stats = (uid) => {
    const t = tasks.filter((x) => (x.assignees||[]).includes(uid));
    const spent = t.reduce((acc, x) => acc + (x.time_spent || 0), 0);
    const open = t.filter((x) => x.status !== "done").length;
    const l = leaves.filter((lv) => lv.user_id === uid);
    return { tasks: t.length, open, spent, leaves: l.length };
  };

  const canManage = user && (user.role === "leadership" || user.role === "manager");

  return (
    <>
      <PageHeader eyebrow="Team" title="Team database" description="Roster, tasks, leaves and project assignments.">
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
                  <th className="px-4 py-2">Projects</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Joined</th>
                  <th className="px-4 py-2">Birthday</th>
                  <th className="px-4 py-2 text-right">Open</th>
                  <th className="px-4 py-2 text-right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const s = stats(u.id);
                  const projs = projectsByUser[u.id] || [];
                  return (
                    <tr key={u.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`team-row-${u.id}`}>
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
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {projs.length === 0 ? "—" : <span className="text-xs">{projs.slice(0,2).map(p=>p.name).join(", ")}{projs.length>2?` +${projs.length-2}`:""}</span>}
                      </td>
                      <td className="px-4 py-3"><span className={`text-xs px-2.5 py-0.5 rounded-full ${u.in_office ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#DBEAFE] text-[#1E40AF]"}`}>{u.in_office ? "In office" : "Remote"}</span></td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{u.joining_date || "—"}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{u.birthday || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.open}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.spent}h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddMemberModal onClose={()=>setShowAdd(false)} onSaved={load} />}
    </>
  );
}

function AddMemberModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    email: "", password: "", name: "", role: "team", title: "", team: "Design", in_office: true,
    joining_date: "", birthday: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.post("/auth/register", form); onSaved && onSaved(); onClose(); }
    catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  const upd = (k, v) => setForm((f)=>({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>New team member</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <input required value={form.name} onChange={(e)=>upd("name",e.target.value)} placeholder="Full name" className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-name-input" />
            <input required value={form.email} type="email" onChange={(e)=>upd("email",e.target.value)} placeholder="Email" className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-email-input" />
          </div>
          <input required value={form.password} type="password" onChange={(e)=>upd("password",e.target.value)} placeholder="Password" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-password-input" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.role} onChange={(e)=>upd("role",e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="member-role-select">
              <option value="team">Team</option><option value="manager">Manager</option><option value="leadership">Leadership</option>
            </select>
            <input value={form.team} onChange={(e)=>upd("team",e.target.value)} placeholder="Team" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
          </div>
          <input value={form.title} onChange={(e)=>upd("title",e.target.value)} placeholder="Title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.joining_date} onChange={(e)=>upd("joining_date",e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" />
            <input type="date" value={form.birthday} onChange={(e)=>upd("birthday",e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.in_office} onChange={(e)=>upd("in_office",e.target.checked)} /> In-office
          </label>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="member-save-btn">{busy?"Saving…":"Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
