import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Empty, Avatar } from "@/components/ui-bits";
import { Download, Plus, Search, Building2, UserPlus, X, Pencil, Trash2 } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);     // client object when editing
  const [linkFor, setLinkFor] = useState(null);   // client object when "Link user" is open

  const load = () => Promise.all([
    api.get("/clients").then((r)=>setClients(r.data)).catch(()=>setClients([])),
    api.get("/projects").then((r)=>setProjects(r.data)).catch(()=>setProjects([])),
    api.get("/users").then((r)=>setUsers(r.data)).catch(()=>setUsers([])),
  ]);
  useEffect(() => { load(); }, []);

  const visible = useMemo(()=> clients.filter(c=> !search || c.company.toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const projectsByClient = useMemo(()=> {
    const m = {};
    projects.forEach((p)=> { if (p.client_id) { (m[p.client_id] = m[p.client_id] || []).push(p); } });
    return m;
  }, [projects]);
  const clientUsersByClient = useMemo(() => {
    const m = {};
    users.filter((u)=>u.role === "client" && u.client_id).forEach((u)=> { (m[u.client_id] = m[u.client_id] || []).push(u); });
    return m;
  }, [users]);
  const unlinkedClientUsers = useMemo(() => users.filter((u)=> u.role === "client" && !u.client_id), [users]);

  return (
    <>
      <PageHeader eyebrow="Clients" title="Clients" description="Companies, contacts, and active projects.">
        <a href={`${import.meta.env.REACT_APP_BACKEND_URL}/api/export/clients.csv`} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2" data-testid="clients-export-btn">
          <Download className="w-4 h-4" /> Export
        </a>
        <button onClick={()=>setShowAdd(true)} className="bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white text-sm font-semibold rounded-md px-3 py-2 flex items-center gap-2" data-testid="clients-add-btn">
          <Plus className="w-4 h-4" /> Client
        </button>
      </PageHeader>
      <div className="p-8 space-y-4">
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search clients…"
            className="pl-9 pr-3 py-2 text-sm bg-white border border-[var(--border-default)] rounded-md w-64" data-testid="clients-search-input" />
        </div>
        {visible.length === 0 ? <Empty title="No clients yet" hint="Add your first client to start linking projects." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((c) => {
              const projs = projectsByClient[c.id] || [];
              const linked = clientUsersByClient[c.id] || [];
              return (
                <div key={c.id} className="bg-white border border-[var(--border-default)] rounded-md p-5" data-testid={`client-card-${c.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-md bg-[var(--bg-surface-active)] flex items-center justify-center"><Building2 className="w-5 h-5" strokeWidth={1.75} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{c.company}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{c.location || "—"}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {(c.contacts || []).map((p, i) => (
                      <div key={i} className="text-sm">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{p.role || "—"} · {p.email || "—"} · {p.phone || "—"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Projects ({projs.length})</div>
                    <div className="text-xs text-[var(--text-secondary)]">{projs.map(p=>p.name).join(" · ") || "—"}</div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Client portal users ({linked.length})</div>
                      <button onClick={()=>setLinkFor(c)} className="text-xs flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid={`client-link-user-btn-${c.id}`}>
                        <UserPlus className="w-3.5 h-3.5" /> Assign user
                      </button>
                    </div>
                    {linked.length === 0 ? (
                      <div className="text-xs text-[var(--text-tertiary)]">No client users yet. Assign one so the client can log in.</div>
                    ) : (
                      <ul className="space-y-1.5">
                        {linked.map((u) => (
                          <li key={u.id} className="flex items-center gap-2 text-sm" data-testid={`client-user-${u.id}`}>
                            <Avatar user={u} size={20} />
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{u.name}</div>
                              <div className="text-[10px] text-[var(--text-tertiary)] truncate">{u.email}</div>
                            </div>
                            <button
                              onClick={async ()=>{ await api.patch(`/users/${u.id}`, { client_id: null }).catch(()=>{}); load(); }}
                              className="text-[var(--text-tertiary)] hover:text-red-600"
                              title="Unlink from client"
                              data-testid={`client-unlink-${u.id}`}
                            ><X className="w-3.5 h-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showAdd && <ClientFormModal onClose={()=>setShowAdd(false)} onSaved={load} />}
      {editing && <ClientFormModal client={editing} onClose={()=>setEditing(null)} onSaved={()=>{ setEditing(null); load(); }} />}
      {linkFor && (
        <LinkClientUserModal
          client={linkFor}
          unlinkedUsers={unlinkedClientUsers}
          onClose={()=>setLinkFor(null)}
          onSaved={()=>{ setLinkFor(null); load(); }}
        />
      )}
    </>
  );
}

function ClientFormModal({ client, onClose, onSaved }) {
  const isEdit = !!client;
  const [company, setCompany] = useState(client?.company || "");
  const [location, setLocation] = useState(client?.location || "");
  const [contacts, setContacts] = useState(
    client?.contacts?.length ? client.contacts : [{ name:"", email:"", phone:"", role:"" }]
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const updateC = (i, k, v) => setContacts((cs)=> cs.map((c,idx)=> idx===i ? { ...c, [k]: v } : c));
  const removeC = (i) => setContacts((cs)=> cs.length === 1 ? cs : cs.filter((_,idx)=> idx!==i));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const payload = { company, location, contacts: contacts.filter(c=>c.name||c.email||c.phone) };
    try {
      if (isEdit) await api.patch(`/clients/${client.id}`, payload);
      else await api.post("/clients", payload);
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="client-form-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{isEdit ? "Edit client" : "New client"}</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Company name" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="client-company-input" />
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="client-location-input" />
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Contacts</div>
            {contacts.map((c, i) => (
              <div key={i} className="relative grid grid-cols-2 gap-2 p-2 rounded-md border border-[var(--border-subtle)]">
                <input value={c.name||""} onChange={(e)=>updateC(i,"name",e.target.value)} placeholder="Contact name" className="border border-[var(--border-default)] rounded-md px-3 py-2" data-testid={`client-contact-name-${i}`} />
                <input value={c.role||""} onChange={(e)=>updateC(i,"role",e.target.value)} placeholder="Role" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
                <input value={c.email||""} onChange={(e)=>updateC(i,"email",e.target.value)} placeholder="Email" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
                <input value={c.phone||""} onChange={(e)=>updateC(i,"phone",e.target.value)} placeholder="Phone" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
                {contacts.length > 1 && (
                  <button type="button" onClick={()=>removeC(i)} className="absolute -top-2 -right-2 bg-white border border-[var(--border-default)] rounded-full p-1 text-[var(--text-tertiary)] hover:text-red-600" aria-label="Remove contact" data-testid={`client-contact-remove-${i}`}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={()=>setContacts((cs)=>[...cs,{name:"",email:"",phone:"",role:""}])} className="text-xs text-[var(--text-secondary)] hover:underline">+ Add contact</button>
          </div>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="client-save-btn">{busy?"Saving…":(isEdit?"Save changes":"Create")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


function LinkClientUserModal({ client, unlinkedUsers, onClose, onSaved }) {
  const [mode, setMode] = useState(unlinkedUsers.length > 0 ? "existing" : "new");
  const [pickedId, setPickedId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (mode === "existing") {
        if (!pickedId) throw new Error("Pick a user");
        await api.patch(`/users/${pickedId}`, { client_id: client.id });
      } else {
        await api.post("/auth/register", {
          email, password, name, role: "client", client_id: client.id,
        });
      }
      onSaved && onSaved();
    } catch (e2) {
      setErr(e2.response?.data?.detail || e2.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="link-client-user-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-md p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Assign client user</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Give <span className="font-semibold text-[var(--text-primary)]">{client.company}</span> access to their portal.</p>

        <div className="mt-4 flex bg-[var(--bg-surface-hover)] rounded-md p-1 text-xs font-semibold">
          <button type="button" onClick={()=>setMode("existing")}
            className={`flex-1 px-3 py-1.5 rounded ${mode === "existing" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
            data-testid="link-mode-existing">Existing user ({unlinkedUsers.length})</button>
          <button type="button" onClick={()=>setMode("new")}
            className={`flex-1 px-3 py-1.5 rounded ${mode === "new" ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"}`}
            data-testid="link-mode-new">Create new</button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          {mode === "existing" ? (
            unlinkedUsers.length === 0 ? (
              <div className="text-xs text-[var(--text-tertiary)] py-4 text-center border border-dashed border-[var(--border-default)] rounded-md">
                No unlinked client users available. Switch to “Create new”.
              </div>
            ) : (
              <select required value={pickedId} onChange={(e)=>setPickedId(e.target.value)} data-testid="link-existing-select"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2">
                <option value="">— Select a client user —</option>
                {unlinkedUsers.map((u)=> <option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}
              </select>
            )
          ) : (
            <>
              <input required value={name} onChange={(e)=>setName(e.target.value)} placeholder="Full name" data-testid="link-new-name"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
              <input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" data-testid="link-new-email"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
              <input required type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Temporary password" data-testid="link-new-password"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
            </>
          )}
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="link-save-btn">
              {busy ? "Saving…" : (mode === "existing" ? "Assign" : "Create & assign")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
