import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { ModalShell, fmtINR, fmtDate } from "@/components/section-bits";

const STAGES = [
  { key: "new", label: "New", color: "#94A3B8" },
  { key: "contacted", label: "Contacted", color: "#3B82F6" },
  { key: "qualified", label: "Qualified", color: "#8B5CF6" },
  { key: "proposal", label: "Proposal", color: "#F59E0B" },
  { key: "won", label: "Won", color: "#10B981" },
  { key: "lost", label: "Lost", color: "#EF4444" },
];

export default function Sales() {
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [edit, setEdit] = useState(null);
  const [view, setView] = useState("board");

  const load = () => api.get("/leads").then((r) => setLeads(r.data));
  useEffect(() => {
    load();
    api.get("/users").then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  const kpis = useMemo(() => {
    const open = leads.filter((l) => !["won", "lost"].includes(l.status));
    const won = leads.filter((l) => l.status === "won");
    const lost = leads.filter((l) => l.status === "lost");
    const decided = won.length + lost.length;
    return {
      open: open.length,
      pipelineValue: open.reduce((s, l) => s + (l.value || 0), 0),
      wonValue: won.reduce((s, l) => s + (l.value || 0), 0),
      winRate: decided > 0 ? Math.round((won.length / decided) * 100) : null,
    };
  }, [leads]);

  const move = async (lead, status) => {
    setLeads((prev) => prev.map((x) => x.id === lead.id ? { ...x, status } : x));
    await api.patch(`/leads/${lead.id}`, { status }).catch(() => {});
  };

  return (
    <>
      <PageHeader eyebrow="Sales" title="Sales pipeline" description="Track inbound leads from first touch to closed deal." />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Open leads" value={kpis.open} />
          <Kpi label="Pipeline value" value={fmtINR(kpis.pipelineValue)} />
          <Kpi label="Won value (all-time)" value={fmtINR(kpis.wonValue)} accent="#10B981" />
          <Kpi label="Win rate" value={kpis.winRate == null ? "—" : `${kpis.winRate}%`} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => setView("board")} className={`px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md ${view === "board" ? "bg-[var(--text-primary)] text-white" : "border border-[var(--border-default)]"}`} data-testid="sales-view-board">Board</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs uppercase tracking-widest font-semibold rounded-md ${view === "list" ? "bg-[var(--text-primary)] text-white" : "border border-[var(--border-default)]"}`} data-testid="sales-view-list">List</button>
          </div>
          <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md" data-testid="lead-add-btn">+ Add lead</button>
        </div>

        {view === "board" ? <Board leads={leads} onMove={move} onEdit={setEdit} /> : <List leads={leads} users={users} onEdit={setEdit} />}
      </div>

      <LeadModal open={!!edit} lead={edit === "new" ? null : edit} users={users} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-4">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'", color: accent || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

function Board({ leads, onMove, onEdit }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {STAGES.map((s) => {
        const rows = leads.filter((l) => l.status === s.key);
        return (
          <div key={s.key} className="bg-white border border-[var(--border-default)] rounded-md p-3" data-testid={`sales-col-${s.key}`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <h4 className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{s.label}</h4>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{rows.length}</span>
            </div>
            <div className="space-y-2 min-h-[40px]">
              {rows.map((l) => (
                <div key={l.id} onClick={() => onEdit(l)} className="border border-[var(--border-default)] rounded-md p-2.5 hover:shadow-sm cursor-pointer" data-testid={`lead-card-${l.id}`}>
                  <div className="text-sm font-medium leading-tight">{l.name}</div>
                  {l.company && <div className="text-xs text-[var(--text-secondary)]">{l.company}</div>}
                  {l.value > 0 && <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mt-1">{fmtINR(l.value)}</div>}
                  <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                    {STAGES.filter((x) => x.key !== s.key).slice(0, 3).map((x) => (
                      <button key={x.key} onClick={() => onMove(l, x.key)} className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]" data-testid={`lead-move-${l.id}-${x.key}`}>{x.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function List({ leads, users, onEdit }) {
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
      <table className="w-full text-sm" data-testid="leads-table">
        <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
          <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
            <th className="px-4 py-2.5">Lead</th>
            <th className="px-4 py-2.5">Company</th>
            <th className="px-4 py-2.5">Stage</th>
            <th className="px-4 py-2.5 text-right">Value</th>
            <th className="px-4 py-2.5">Owner</th>
            <th className="px-4 py-2.5">Close</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-tertiary)]">No leads yet</td></tr>
          ) : leads.map((l) => {
            const s = STAGES.find((x) => x.key === l.status) || STAGES[0];
            return (
              <tr key={l.id} onClick={() => onEdit(l)} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] cursor-pointer" data-testid={`lead-row-${l.id}`}>
                <td className="px-4 py-3 font-medium">{l.name}{l.email && <div className="text-xs text-[var(--text-secondary)]">{l.email}</div>}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{l.company || "—"}</td>
                <td className="px-4 py-3"><span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm" style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}30` }}>{s.label}</span></td>
                <td className="px-4 py-3 text-right">{fmtINR(l.value)}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{userById[l.owner_id]?.name || "—"}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{fmtDate(l.expected_close)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeadModal({ open, lead, users, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) {
    setF({
      name: lead?.name || "", company: lead?.company || "", email: lead?.email || "",
      phone: lead?.phone || "", source: lead?.source || "", status: lead?.status || "new",
      value: lead?.value ?? "", owner_id: lead?.owner_id || "",
      notes: lead?.notes || "", expected_close: lead?.expected_close || "",
    });
  } }, [open, lead]);

  const upd = (k, v) => setF((prev) => ({ ...prev, [k]: v }));
  const save = async () => {
    if (!f.name?.trim()) return;
    setBusy(true);
    try {
      const body = { ...f, value: f.value === "" ? 0 : Number(f.value), owner_id: f.owner_id || null, expected_close: f.expected_close || null };
      if (lead) await api.patch(`/leads/${lead.id}`, body);
      else await api.post("/leads", body);
      onSaved();
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!lead || !window.confirm("Delete this lead?")) return;
    await api.delete(`/leads/${lead.id}`);
    onSaved();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={lead ? "Edit lead" : "Add lead"} width={640}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={f.name || ""} onChange={(e) => upd("name", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="lead-name-input" /></Field>
        <Field label="Company"><input value={f.company || ""} onChange={(e) => upd("company", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="lead-company-input" /></Field>
        <Field label="Email"><input value={f.email || ""} onChange={(e) => upd("email", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" /></Field>
        <Field label="Phone"><input value={f.phone || ""} onChange={(e) => upd("phone", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" /></Field>
        <Field label="Source"><input value={f.source || ""} onChange={(e) => upd("source", e.target.value)} placeholder="referral / inbound / linkedin" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" /></Field>
        <Field label="Stage">
          <select value={f.status || "new"} onChange={(e) => upd("status", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white" data-testid="lead-stage-select">
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Value (₹)"><input type="number" min="0" step="1000" value={f.value || ""} onChange={(e) => upd("value", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="lead-value-input" /></Field>
        <Field label="Expected close"><input type="date" value={f.expected_close || ""} onChange={(e) => upd("expected_close", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" /></Field>
        <Field label="Owner">
          <select value={f.owner_id || ""} onChange={(e) => upd("owner_id", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white">
            <option value="">—</option>
            {users.filter((u) => u.role !== "client").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea rows={4} value={f.notes || ""} onChange={(e) => upd("notes", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="lead-notes-input" /></Field>
      <div className="flex items-center justify-between">
        {lead ? <button onClick={remove} className="text-xs text-red-600 hover:underline">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="lead-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}
