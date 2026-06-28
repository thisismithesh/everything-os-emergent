import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { TabBar, Pill, TagInput, ModalShell, fmtDate } from "@/components/section-bits";

const TABS = [
  { key: "plan", label: "Plan" },
  { key: "tracker", label: "Tracker" },
  { key: "database", label: "Database" },
];

export default function Marketing() {
  const [tab, setTab] = useState("plan");
  return (
    <>
      <PageHeader eyebrow="Marketing" title="Marketing" description="Plan, run and archive marketing work." />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="p-8">
        {tab === "plan" && <PlanTab />}
        {tab === "tracker" && <TrackerTab />}
        {tab === "database" && <DatabaseTab />}
      </div>
    </>
  );
}

/* ---------------- PLAN (text docs with tags) ---------------- */
function PlanTab() {
  const [docs, setDocs] = useState([]);
  const [edit, setEdit] = useState(null);   // doc being edited or "new"
  const [filterTag, setFilterTag] = useState("");

  const load = () => api.get("/documents", { params: { scope: "marketing" } }).then((r) => setDocs(r.data));
  useEffect(() => { load(); }, []);

  const tags = useMemo(() => Array.from(new Set(docs.flatMap((d) => d.tags || []))).sort(), [docs]);
  const shown = filterTag ? docs.filter((d) => (d.tags || []).includes(filterTag)) : docs;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilterTag("")} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${!filterTag ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`} data-testid="filter-tag-all">All</button>
          {tags.map((t) => (
            <button key={t} onClick={() => setFilterTag(t)} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${filterTag === t ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`} data-testid={`filter-tag-${t}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md hover:opacity-90" data-testid="plan-add-btn">+ New document</button>
      </div>
      {shown.length === 0 ? (
        <Empty title="No documents yet" hint="Create your first marketing plan / brief / idea doc." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((d) => (
            <button key={d.id} onClick={() => setEdit(d)} className="text-left bg-white border border-[var(--border-default)] rounded-md p-4 hover:shadow-sm transition-shadow" data-testid={`doc-card-${d.id}`}>
              <div className="font-semibold text-sm tracking-tight mb-1">{d.title}</div>
              <div className="text-xs text-[var(--text-secondary)] line-clamp-3 whitespace-pre-line">{d.body || "—"}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                {(d.tags || []).map((t) => <Pill key={t}>{t}</Pill>)}
              </div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mt-2">Updated {fmtDate(d.updated_at)}</div>
            </button>
          ))}
        </div>
      )}
      <DocModal open={!!edit} doc={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} scope="marketing" />
    </section>
  );
}

function DocModal({ open, doc, onClose, onSaved, scope }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setTitle(doc?.title || ""); setBody(doc?.body || ""); setTags(doc?.tags || []); } }, [open, doc]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      if (doc) await api.patch(`/documents/${doc.id}`, { title, body, tags });
      else await api.post("/documents", { title, body, tags, scope });
      onSaved();
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!doc) return;
    if (!window.confirm("Delete this document?")) return;
    await api.delete(`/documents/${doc.id}`);
    onSaved();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={doc ? "Edit document" : "New document"} width={720}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-base font-semibold" data-testid="doc-title-input" />
      <TagInput value={tags} onChange={setTags} testid="doc-tag-input" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your content here…" rows={12} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="doc-body-input" />
      <div className="flex items-center justify-between">
        {doc ? <button onClick={remove} className="text-xs text-red-600 hover:underline" data-testid="doc-delete-btn">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="doc-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- TRACKER (3-column board) ---------------- */
function TrackerTab() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);
  const [users, setUsers] = useState([]);

  const load = () => api.get("/marketing/tasks").then((r) => setItems(r.data));
  useEffect(() => { load(); api.get("/users").then((r) => setUsers(r.data)).catch(() => {}); }, []);

  const cols = [
    { key: "backlog", label: "Backlog", color: "#94A3B8" },
    { key: "active", label: "Active", color: "#0A0A0A" },
    { key: "completed", label: "Completed", color: "#10B981" },
  ];

  const move = async (it, status) => {
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, status } : x));
    await api.patch(`/marketing/tasks/${it.id}`, { status }).catch(() => {});
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md hover:opacity-90" data-testid="tracker-add-btn">+ New task</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cols.map((c) => {
          const rows = items.filter((x) => x.status === c.key);
          return (
            <div key={c.key} className="bg-white border border-[var(--border-default)] rounded-md p-3" data-testid={`tracker-col-${c.key}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <h4 className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{c.label}</h4>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{rows.length}</span>
              </div>
              <div className="space-y-2">
                {rows.length === 0 && <div className="text-xs text-[var(--text-tertiary)] px-1 py-3">—</div>}
                {rows.map((t) => (
                  <div key={t.id} onClick={() => setEdit(t)} className="border border-[var(--border-default)] rounded-md p-2.5 hover:shadow-sm cursor-pointer" data-testid={`mtask-card-${t.id}`}>
                    <div className="text-sm font-medium leading-tight">{t.title}</div>
                    {t.due_date && <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mt-1">Due {fmtDate(t.due_date)}</div>}
                    <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                      {cols.filter((x) => x.key !== c.key).map((x) => (
                        <button key={x.key} onClick={() => move(t, x.key)} className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded-sm border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]" data-testid={`mtask-move-${t.id}-${x.key}`}>→ {x.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <MTaskModal open={!!edit} item={edit === "new" ? null : edit} users={users} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </section>
  );
}

function MTaskModal({ open, item, users, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("backlog");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) {
    setTitle(item?.title || ""); setDescription(item?.description || "");
    setStatus(item?.status || "backlog"); setAssigneeId(item?.assignee_id || "");
    setDueDate(item?.due_date || "");
  } }, [open, item]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const body = { title, description, status, assignee_id: assigneeId || null, due_date: dueDate || null };
      if (item) await api.patch(`/marketing/tasks/${item.id}`, body);
      else await api.post("/marketing/tasks", body);
      onSaved();
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!item) return;
    if (!window.confirm("Delete this task?")) return;
    await api.delete(`/marketing/tasks/${item.id}`);
    onSaved();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={item ? "Edit task" : "New marketing task"}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="mtask-title-input" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="mtask-desc-input" />
      <div className="grid grid-cols-3 gap-2">
        <SelectField label="Status" value={status} onChange={setStatus} options={[["backlog", "Backlog"], ["active", "Active"], ["completed", "Completed"]]} />
        <SelectField label="Assignee" value={assigneeId} onChange={setAssigneeId} options={[["", "—"], ...users.filter((u) => u.role !== "client").map((u) => [u.id, u.name])]} />
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Due</div>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="flex items-center justify-between">
        {item ? <button onClick={remove} className="text-xs text-red-600 hover:underline" data-testid="mtask-delete-btn">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="mtask-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- DATABASE (completed marketing materials) ---------------- */
function DatabaseTab() {
  const [items, setItems] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = () => api.get("/marketing/materials").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const togglePosted = async (m) => {
    setItems((prev) => prev.map((x) => x.id === m.id ? { ...x, posted: !x.posted } : x));
    await api.patch(`/marketing/materials/${m.id}`, { posted: !m.posted });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md hover:opacity-90" data-testid="material-add-btn">+ Add material</button>
      </div>
      {items.length === 0 ? <Empty title="No materials yet" hint="Add a link to your first published piece." /> : (
        <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
          <table className="w-full text-sm" data-testid="materials-table">
            <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
              <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Tags</th>
                <th className="px-4 py-2.5">Post date</th>
                <th className="px-4 py-2.5">Link</th>
                <th className="px-4 py-2.5 w-24">Posted</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`material-row-${m.id}`}>
                  <td className="px-4 py-3 font-medium">{m.title}</td>
                  <td className="px-4 py-3"><div className="flex gap-1.5 flex-wrap">{(m.tags || []).map((t) => <Pill key={t}>{t}</Pill>)}</div></td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{fmtDate(m.post_date)}</td>
                  <td className="px-4 py-3">{m.link ? <a href={m.link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate inline-block max-w-[260px] align-bottom">{m.link}</a> : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => togglePosted(m)} data-testid={`material-posted-${m.id}`} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm ${m.posted ? "bg-green-50 text-green-700 border border-green-200" : "border border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
                      {m.posted ? "✓ Posted" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setEdit(m)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid={`material-edit-${m.id}`}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <MaterialModal open={!!edit} item={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </section>
  );
}

function MaterialModal({ open, item, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [postDate, setPostDate] = useState("");
  const [posted, setPosted] = useState(false);
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) {
    setTitle(item?.title || ""); setLink(item?.link || ""); setPostDate(item?.post_date || "");
    setPosted(!!item?.posted); setTags(item?.tags || []); setNotes(item?.notes || "");
  } }, [open, item]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const body = { title, link, post_date: postDate || null, posted, tags, notes };
      if (item) await api.patch(`/marketing/materials/${item.id}`, body);
      else await api.post("/marketing/materials", body);
      onSaved();
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!item || !window.confirm("Delete this material?")) return;
    await api.delete(`/marketing/materials/${item.id}`);
    onSaved();
  };

  return (
    <ModalShell open={open} onClose={onClose} title={item ? "Edit material" : "Add material"}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="material-title-input" />
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="material-link-input" />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Post date</div>
          <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="material-date-input" />
        </label>
        <label className="flex items-center gap-2 mt-6">
          <input type="checkbox" checked={posted} onChange={(e) => setPosted(e.target.checked)} data-testid="material-posted-checkbox" />
          <span className="text-sm">Marked as posted</span>
        </label>
      </div>
      <TagInput value={tags} onChange={setTags} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={3} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" />
      <div className="flex items-center justify-between">
        {item ? <button onClick={remove} className="text-xs text-red-600 hover:underline">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="material-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- shared little bits ---------------- */
function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Empty({ title, hint }) {
  return (
    <div className="bg-white border border-dashed border-[var(--border-default)] rounded-md p-10 text-center">
      <div className="text-sm font-semibold mb-1">{title}</div>
      {hint && <div className="text-xs text-[var(--text-secondary)]">{hint}</div>}
    </div>
  );
}
