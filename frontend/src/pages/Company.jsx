import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { TabBar, Pill, TagInput, ModalShell, fmtDate } from "@/components/section-bits";

const TABS = [
  { key: "board", label: "Message board" },
  { key: "activities", label: "Activities" },
  { key: "wiki", label: "Wiki" },
  { key: "journal", label: "Career journal" },
];

export default function Company() {
  const [tab, setTab] = useState("board");
  return (
    <>
      <PageHeader eyebrow="Company" title="Company" description="Announcements, activities, wiki and your personal journal." />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="p-8">
        {tab === "board" && <BoardTab />}
        {tab === "activities" && <ActivitiesTab />}
        {tab === "wiki" && <WikiTab />}
        {tab === "journal" && <JournalTab />}
      </div>
    </>
  );
}

/* ---------------- MESSAGE BOARD ---------------- */
const POST_TYPES = [
  { key: "announcement", label: "Announcement", color: "#3B82F6", icon: "📣" },
  { key: "appreciation", label: "Appreciation", color: "#10B981", icon: "💚" },
  { key: "boast", label: "Boast", color: "#F59E0B", icon: "🏆" },
];

function BoardTab() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("all");
  const [composer, setComposer] = useState({ type: "announcement", body: "", appreciate_user_id: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api.get("/posts").then((r) => setPosts(r.data));
  useEffect(() => { load(); api.get("/users").then((r) => setUsers(r.data)).catch(() => {}); }, []);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const post = async () => {
    if (!composer.body.trim()) return;
    setBusy(true);
    try {
      const body = { type: composer.type, body: composer.body, appreciate_user_id: composer.type === "appreciation" ? (composer.appreciate_user_id || null) : null };
      await api.post("/posts", body);
      setComposer({ type: "announcement", body: "", appreciate_user_id: "" });
      load();
    } finally { setBusy(false); }
  };
  const remove = async (p) => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/posts/${p.id}`);
    load();
  };

  const shown = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  return (
    <section className="space-y-5">
      <div className="bg-white border border-[var(--border-default)] rounded-md p-4">
        <div className="flex items-center gap-2 mb-3">
          {POST_TYPES.map((t) => (
            <button key={t.key} onClick={() => setComposer((c) => ({ ...c, type: t.key }))} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${composer.type === t.key ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`} data-testid={`composer-type-${t.key}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {composer.type === "appreciation" && (
          <select value={composer.appreciate_user_id} onChange={(e) => setComposer((c) => ({ ...c, appreciate_user_id: e.target.value }))} className="mb-2 w-full md:w-72 border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white" data-testid="composer-appreciate-user">
            <option value="">Appreciate whom? (optional)</option>
            {users.filter((u) => u.role !== "client" && u.id !== user?.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <textarea value={composer.body} onChange={(e) => setComposer((c) => ({ ...c, body: e.target.value }))} rows={3} placeholder={composer.type === "announcement" ? "Share an announcement…" : composer.type === "appreciation" ? "Say thanks to a teammate…" : "Brag a little — share a recent win!"} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="composer-body" />
        <div className="flex items-center justify-end mt-2">
          <button onClick={post} disabled={busy || !composer.body.trim()} className="px-4 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-50" data-testid="composer-post-btn">{busy ? "Posting…" : "Post"}</button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setFilter("all")} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${filter === "all" ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`} data-testid="filter-all">All</button>
        {POST_TYPES.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${filter === t.key ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`} data-testid={`filter-${t.key}`}>{t.label}</button>
        ))}
      </div>

      {shown.length === 0 ? <Empty title="No posts yet" hint="Be the first to share something!" /> : (
        <div className="space-y-3">
          {shown.map((p) => {
            const t = POST_TYPES.find((x) => x.key === p.type);
            const author = userById[p.author_id];
            const target = userById[p.appreciate_user_id];
            const canDelete = user && (p.author_id === user.id || ["leadership", "manager"].includes(user.role));
            return (
              <div key={p.id} className="bg-white border border-[var(--border-default)] rounded-md p-4" data-testid={`post-${p.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.color }}>{t.label}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">·</span>
                    <span className="text-xs text-[var(--text-secondary)]">{author?.name || "Unknown"}</span>
                    {target && <><span className="text-xs text-[var(--text-tertiary)]">→</span><span className="text-xs font-medium">{target.name}</span></>}
                    <span className="text-xs text-[var(--text-tertiary)]">·</span>
                    <span className="text-xs text-[var(--text-tertiary)]">{fmtDate(p.created_at)}</span>
                  </div>
                  {canDelete && <button onClick={() => remove(p)} className="text-[var(--text-tertiary)] hover:text-red-600 text-xs" data-testid={`post-delete-${p.id}`}>Delete</button>}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{p.body}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- ACTIVITIES ---------------- */
const CADENCE_LABEL = { weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", adhoc: "Ad-hoc" };

function ActivitiesTab() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = () => api.get("/activities").then((r) => setItems(r.data));
  useEffect(() => { load(); api.get("/users").then((r) => setUsers(r.data)).catch(() => {}); }, []);
  const userById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md" data-testid="activity-add-btn">+ New activity</button>
      </div>
      {items.length === 0 ? <Empty title="No activities yet" hint="E.g. weekly presentations, book club, design crit…" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((a) => (
            <button key={a.id} onClick={() => setEdit(a)} className="text-left bg-white border border-[var(--border-default)] rounded-md p-4 hover:shadow-sm" data-testid={`activity-card-${a.id}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold text-base tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{a.name}</div>
                <span className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-tertiary)]">{a.status || "active"}</span>
              </div>
              {a.description && <div className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">{a.description}</div>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Cadence</div><div>{CADENCE_LABEL[a.cadence] || "—"}</div></div>
                <div><div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Next</div><div>{fmtDate(a.next_session)}</div></div>
                <div><div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Organizer</div><div>{userById[a.organizer_id]?.name || "—"}</div></div>
                <div><div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Members</div><div>{(a.members || []).length}</div></div>
              </div>
            </button>
          ))}
        </div>
      )}
      <ActivityModal open={!!edit} item={edit === "new" ? null : edit} users={users} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />
    </section>
  );
}

function ActivityModal({ open, item, users, onClose, onSaved }) {
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) {
    setF({
      name: item?.name || "", description: item?.description || "",
      type: item?.type || "recurring", cadence: item?.cadence || "weekly",
      next_session: item?.next_session || "", organizer_id: item?.organizer_id || "",
      members: item?.members || [], status: item?.status || "active",
    });
  } }, [open, item]);
  const upd = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleMember = (uid) => setF((p) => ({ ...p, members: p.members.includes(uid) ? p.members.filter((x) => x !== uid) : [...p.members, uid] }));
  const save = async () => {
    if (!f.name?.trim()) return;
    setBusy(true);
    try {
      const body = { ...f, organizer_id: f.organizer_id || null, next_session: f.next_session || null };
      if (item) await api.patch(`/activities/${item.id}`, body);
      else await api.post("/activities", body);
      onSaved();
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!item || !window.confirm("Delete this activity?")) return;
    await api.delete(`/activities/${item.id}`);
    onSaved();
  };
  return (
    <ModalShell open={open} onClose={onClose} title={item ? "Edit activity" : "New activity"} width={640}>
      <input value={f.name || ""} onChange={(e) => upd("name", e.target.value)} placeholder="Activity name (e.g. Book club)" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-base font-semibold" data-testid="activity-name-input" />
      <textarea rows={3} value={f.description || ""} onChange={(e) => upd("description", e.target.value)} placeholder="What's this activity about?" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <SelectField label="Type" value={f.type} onChange={(v) => upd("type", v)} options={[["recurring", "Recurring"], ["one_time", "One-time"]]} />
        <SelectField label="Cadence" value={f.cadence} onChange={(v) => upd("cadence", v)} options={Object.entries(CADENCE_LABEL)} />
        <SelectField label="Status" value={f.status} onChange={(v) => upd("status", v)} options={[["active", "Active"], ["paused", "Paused"], ["ended", "Ended"]]} />
        <label className="block">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Next session</div>
          <input type="date" value={f.next_session || ""} onChange={(e) => upd("next_session", e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" />
        </label>
        <SelectField label="Organizer" value={f.organizer_id} onChange={(v) => upd("organizer_id", v)} options={[["", "—"], ...users.filter((u) => u.role !== "client").map((u) => [u.id, u.name])]} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Members</div>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-2 border border-[var(--border-default)] rounded-md">
          {users.filter((u) => u.role !== "client").map((u) => {
            const on = (f.members || []).includes(u.id);
            return (
              <button key={u.id} onClick={() => toggleMember(u.id)} type="button" className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${on ? "bg-[var(--text-primary)] text-white border-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>{u.name}</button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between">
        {item ? <button onClick={remove} className="text-xs text-red-600 hover:underline">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="activity-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- WIKI (re-uses documents with scope=wiki) ---------------- */
function WikiTab() {
  const [docs, setDocs] = useState([]);
  const [edit, setEdit] = useState(null);
  const [filterTag, setFilterTag] = useState("");

  const load = () => api.get("/documents", { params: { scope: "wiki" } }).then((r) => setDocs(r.data));
  useEffect(() => { load(); }, []);

  const tags = useMemo(() => Array.from(new Set(docs.flatMap((d) => d.tags || []))).sort(), [docs]);
  const shown = filterTag ? docs.filter((d) => (d.tags || []).includes(filterTag)) : docs;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilterTag("")} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${!filterTag ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>All</button>
          {tags.map((t) => (
            <button key={t} onClick={() => setFilterTag(t)} className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-sm border ${filterTag === t ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-[var(--border-default)] text-[var(--text-secondary)]"}`}>{t}</button>
          ))}
        </div>
        <button onClick={() => setEdit("new")} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md" data-testid="wiki-add-btn">+ New article</button>
      </div>
      {shown.length === 0 ? <Empty title="No wiki articles yet" hint="Document your processes, values and onboarding info." /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((d) => (
            <button key={d.id} onClick={() => setEdit(d)} className="text-left bg-white border border-[var(--border-default)] rounded-md p-4 hover:shadow-sm" data-testid={`wiki-card-${d.id}`}>
              <div className="font-semibold text-sm tracking-tight mb-1">{d.title}</div>
              <div className="text-xs text-[var(--text-secondary)] line-clamp-3 whitespace-pre-line">{d.body || "—"}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-3">{(d.tags || []).map((t) => <Pill key={t}>{t}</Pill>)}</div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest mt-2">Updated {fmtDate(d.updated_at)}</div>
            </button>
          ))}
        </div>
      )}
      <DocModal open={!!edit} doc={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} scope="wiki" />
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
    if (!doc || !window.confirm("Delete this article?")) return;
    await api.delete(`/documents/${doc.id}`);
    onSaved();
  };
  return (
    <ModalShell open={open} onClose={onClose} title={doc ? "Edit article" : "New article"} width={720}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-base font-semibold" data-testid="doc-title-input" />
      <TagInput value={tags} onChange={setTags} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write here…" rows={14} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="doc-body-input" />
      <div className="flex items-center justify-between">
        {doc ? <button onClick={remove} className="text-xs text-red-600 hover:underline">Delete</button> : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>
          <button onClick={save} disabled={busy} className="px-3 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-60" data-testid="doc-save-btn">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ---------------- CAREER JOURNAL (private per user) ---------------- */
const MOODS = [["great", "🤩 Great"], ["good", "🙂 Good"], ["ok", "😐 OK"], ["low", "😕 Low"]];

function JournalTab() {
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/journal").then((r) => setEntries(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/journal/${editing.id}`, { date, body, mood: mood || null });
      } else {
        await api.post("/journal", { date, body, mood: mood || null });
      }
      setBody(""); setMood(""); setEditing(null); setDate(new Date().toISOString().slice(0, 10));
      load();
    } finally { setBusy(false); }
  };
  const startEdit = (e) => {
    setEditing(e); setDate(e.date); setBody(e.body); setMood(e.mood || "");
    document.querySelector('[data-testid="journal-body-input"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const remove = async (e) => {
    if (!window.confirm("Delete this entry?")) return;
    await api.delete(`/journal/${e.id}`);
    if (editing?.id === e.id) { setEditing(null); setBody(""); setMood(""); }
    load();
  };

  return (
    <section className="space-y-5 max-w-3xl">
      <div className="bg-amber-50/40 border border-amber-200 rounded-md p-3 text-xs text-amber-900">
        Your journal is <span className="font-semibold">private</span> — only you can see your entries.
      </div>

      <div className="bg-white border border-[var(--border-default)] rounded-md p-4 space-y-3">
        <div className="flex items-center gap-3">
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Date</div>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="journal-date-input" />
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Mood</div>
            <select value={mood} onChange={(e) => setMood(e.target.value)} className="border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white" data-testid="journal-mood-select">
              <option value="">—</option>
              {MOODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={editing ? "Update your entry…" : "How was your day? What did you learn / build / struggle with?"} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm" data-testid="journal-body-input" />
        <div className="flex items-center justify-end gap-2">
          {editing && <button onClick={() => { setEditing(null); setBody(""); setMood(""); }} className="px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md">Cancel</button>}
          <button onClick={save} disabled={busy || !body.trim()} className="px-4 py-1.5 text-sm bg-[var(--text-primary)] text-white rounded-md disabled:opacity-50" data-testid="journal-save-btn">{busy ? "Saving…" : editing ? "Update entry" : "Add entry"}</button>
        </div>
      </div>

      {entries.length === 0 ? <Empty title="No entries yet" hint="Write your first daily reflection." /> : (
        <div className="space-y-3">
          {entries.map((e) => {
            const moodLabel = MOODS.find((m) => m[0] === e.mood)?.[1];
            return (
              <div key={e.id} className="bg-white border border-[var(--border-default)] rounded-md p-4" data-testid={`journal-entry-${e.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tracking-tight">{fmtDate(e.date)}</span>
                    {moodLabel && <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{moodLabel}</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(e)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Edit</button>
                    <button onClick={() => remove(e)} className="text-xs text-[var(--text-tertiary)] hover:text-red-600">Delete</button>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{e.body}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------- shared ---------------- */
function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">{label}</div>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full border border-[var(--border-default)] rounded-md px-3 py-2 text-sm bg-white">
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
