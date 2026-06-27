import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Empty } from "@/components/ui-bits";
import { Download, Plus, Search, Building2 } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = () => Promise.all([
    api.get("/clients").then((r)=>setClients(r.data)).catch(()=>setClients([])),
    api.get("/projects").then((r)=>setProjects(r.data)).catch(()=>setProjects([])),
  ]);
  useEffect(() => { load(); }, []);

  const visible = useMemo(()=> clients.filter(c=> !search || c.company.toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const projectsByClient = useMemo(()=> {
    const m = {};
    projects.forEach((p)=> { if (p.client_id) { (m[p.client_id] = m[p.client_id] || []).push(p); } });
    return m;
  }, [projects]);

  return (
    <>
      <PageHeader eyebrow="Clients" title="Clients" description="Companies, contacts, and active projects.">
        <a href={`${process.env.REACT_APP_BACKEND_URL}/api/export/clients.csv`} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] text-sm flex items-center gap-2" data-testid="clients-export-btn">
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
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showAdd && <AddClientModal onClose={()=>setShowAdd(false)} onSaved={load} />}
    </>
  );
}

function AddClientModal({ onClose, onSaved }) {
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [contacts, setContacts] = useState([{ name:"", email:"", phone:"", role:"" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const updateC = (i, k, v) => setContacts((cs)=> cs.map((c,idx)=> idx===i ? { ...c, [k]: v } : c));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.post("/clients", { company, location, contacts: contacts.filter(c=>c.name||c.email) }); onSaved && onSaved(); onClose(); }
    catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-lg p-6">
        <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>New client</h3>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <input required value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Company name" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="client-company-input" />
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
          {contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input value={c.name} onChange={(e)=>updateC(i,"name",e.target.value)} placeholder="Contact name" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
              <input value={c.role} onChange={(e)=>updateC(i,"role",e.target.value)} placeholder="Role" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
              <input value={c.email} onChange={(e)=>updateC(i,"email",e.target.value)} placeholder="Email" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
              <input value={c.phone} onChange={(e)=>updateC(i,"phone",e.target.value)} placeholder="Phone" className="border border-[var(--border-default)] rounded-md px-3 py-2" />
            </div>
          ))}
          <button type="button" onClick={()=>setContacts((cs)=>[...cs,{name:"",email:"",phone:"",role:""}])} className="text-xs text-[var(--text-secondary)] hover:underline">+ Add contact</button>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="client-save-btn">{busy?"Saving…":"Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
