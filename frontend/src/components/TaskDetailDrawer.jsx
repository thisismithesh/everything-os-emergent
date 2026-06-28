import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Avatar, AvatarStack, StatusPill } from "@/components/ui-bits";
import Comments from "@/components/Comments";
import { X, Play, Square, Trash2, Plus, ChevronRight } from "lucide-react";
import { useTimer, formatHMS } from "@/contexts/TimerContext";

const STATUSES = ["todo", "in_progress", "review", "blocked", "done"];

export default function TaskDetailDrawer({ taskId, users = [], onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [entries, setEntries] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [showManual, setShowManual] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [subName, setSubName] = useState("");
  const t = useTimer();

  const load = async () => {
    if (!taskId) { setTask(null); return; }
    const all = await api.get("/tasks").then((r) => r.data).catch(() => []);
    setAllTasks(all);
    setTask(all.find((x) => x.id === taskId) || null);
    const te = await api.get(`/time-entries?task_id=${taskId}`).then((r) => r.data).catch(() => []);
    setEntries(te);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId]);

  const categories = useMemo(() => Array.from(new Set(allTasks.map((x)=>x.category).filter(Boolean))).sort(), [allTasks]);
  const subtasks = useMemo(() => allTasks.filter((x) => x.parent_task_id === taskId), [allTasks, taskId]);

  if (!taskId) return null;

  const userById = (id) => users.find((u) => u.id === id);
  const isMine = t?.active?.task_id === taskId;

  const save = async (patch) => {
    await api.patch(`/tasks/${taskId}`, patch).catch(() => {});
    await load();
    onChanged && onChanged();
  };
  const saveStatus = async (newStatus) => {
    const patch = { status: newStatus };
    if (newStatus === "done" && !task?.completion_date) patch.completion_date = new Date().toISOString().slice(0,10);
    await save(patch);
  };

  const startTimer = async () => { await t.start(taskId); onChanged && onChanged(); };
  const stopTimer = async () => { await t.stop(); await load(); onChanged && onChanged(); };

  const addSubtask = async (e) => {
    e.preventDefault();
    if (!subName.trim()) return;
    await api.post("/tasks", {
      name: subName.trim(),
      project_id: task?.project_id || null,
      parent_task_id: taskId,
      status: "todo", assignees: [],
    }).catch(()=>{});
    setSubName(""); setShowAddSub(false);
    load();
  };

  return (
    <div className="fixed inset-0 z-40" data-testid="task-detail-drawer">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full md:w-[520px] bg-white border-l border-[var(--border-default)] shadow-xl overflow-y-auto">
        <header className="sticky top-0 bg-white border-b border-[var(--border-default)] px-5 py-4 flex items-center justify-between z-10">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">{task?.parent_task_id ? "Subtask" : "Task"}</div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)]" data-testid="task-drawer-close" aria-label="Close"><X className="w-4 h-4" /></button>
        </header>

        {!task ? (
          <div className="p-6 text-sm text-[var(--text-tertiary)]">Loading…</div>
        ) : (
          <div className="p-5 space-y-5">
            <input
              value={task.name}
              onChange={(e) => setTask({ ...task, name: e.target.value })}
              onBlur={(e) => save({ name: e.target.value })}
              data-testid="task-drawer-name"
              className="w-full text-2xl font-black tracking-tight border-0 focus:ring-2 focus:ring-[var(--brand)] rounded-md px-2 -mx-2 py-1"
              style={{ fontFamily: "'Cabinet Grotesk'" }}
            />

            <section className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select value={task.status} onChange={(e) => saveStatus(e.target.value)} className="w-full text-sm border border-[var(--border-default)] rounded-md px-2 py-1.5" data-testid="task-drawer-status">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <input value={task.category || ""} onChange={(e)=>setTask({...task, category: e.target.value})} onBlur={(e)=>save({ category: e.target.value || null })} placeholder="e.g. Website Development" list="task-drawer-category-list" data-testid="task-drawer-category" className="w-full text-sm border border-[var(--border-default)] rounded-md px-2 py-1.5" />
                <datalist id="task-drawer-category-list">{categories.map((c)=><option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Original deadline">
                <input type="date" value={task.original_deadline || ""} onChange={(e) => save({ original_deadline: e.target.value || null })} className="w-full text-sm border border-[var(--border-default)] rounded-md px-2 py-1.5 cursor-pointer" data-testid="task-drawer-original-deadline" />
              </Field>
              <Field label={task.status === "done" ? "Completion date" : "Latest deadline"}>
                <input type="date"
                  value={(task.status === "done" ? (task.completion_date || task.latest_deadline) : task.latest_deadline) || ""}
                  onChange={(e) => save(task.status === "done" ? { completion_date: e.target.value || null } : { latest_deadline: e.target.value || null })}
                  className="w-full text-sm border border-[var(--border-default)] rounded-md px-2 py-1.5 cursor-pointer"
                  data-testid="task-drawer-latest-deadline" />
              </Field>
              <Field label="Estimate (h)">
                <input type="number" min="0" step="0.25" value={task.estimated_hours ?? 0} onChange={(e) => save({ estimated_hours: Number(e.target.value) })} className="w-full text-sm border border-[var(--border-default)] rounded-md px-2 py-1.5" data-testid="task-drawer-estimate" />
              </Field>
              <Field label="Time spent (h)">
                <div className="text-sm font-semibold tabular-nums px-2 py-1.5 bg-[var(--bg-surface-hover)] rounded-md">{task.time_spent || 0}</div>
              </Field>
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2">Assignees</div>
              <div className="flex flex-wrap gap-1.5">
                {users.filter((u) => u.role !== "client").map((u) => {
                  const on = (task.assignees || []).includes(u.id);
                  return (
                    <button key={u.id} onClick={() => save({ assignees: on ? task.assignees.filter((x) => x !== u.id) : [...(task.assignees || []), u.id] })}
                      data-testid={`task-drawer-assignee-${u.id}`}
                      className={`flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 border transition-all ${on ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-white text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]"}`}>
                      <Avatar user={u} size={18} />
                      {u.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-[var(--bg-surface-hover)] rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Timer</div>
                  {isMine ? (
                    <div className="text-xl font-black tabular-nums tracking-tight mt-0.5" style={{ fontFamily: "'Cabinet Grotesk'" }} data-testid="task-drawer-elapsed">{formatHMS(t.elapsedSeconds)}</div>
                  ) : (
                    <div className="text-sm text-[var(--text-secondary)] mt-0.5">Track time on this task.</div>
                  )}
                </div>
                {isMine ? (
                  <button onClick={stopTimer} className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-semibold flex items-center gap-2" data-testid="task-drawer-stop"><Square className="w-4 h-4" /> Stop</button>
                ) : (
                  <button onClick={startTimer} className="px-3 py-2 rounded-md bg-[var(--brand)] text-white text-sm font-semibold flex items-center gap-2" data-testid="task-drawer-start"><Play className="w-4 h-4" /> Start</button>
                )}
              </div>
            </section>

            {/* Subtasks */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Subtasks ({subtasks.length})</div>
                {!task.parent_task_id && (
                  <button onClick={()=>setShowAddSub((v)=>!v)} className="text-xs flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid="task-drawer-add-subtask"><Plus className="w-3 h-3" /> Subtask</button>
                )}
              </div>
              {showAddSub && (
                <form onSubmit={addSubtask} className="flex gap-2 mb-2">
                  <input autoFocus value={subName} onChange={(e)=>setSubName(e.target.value)} placeholder="Subtask name" data-testid="subtask-name-input"
                    className="flex-1 text-sm border border-[var(--border-default)] rounded-md px-3 py-1.5" />
                  <button type="submit" className="px-3 py-1.5 text-sm rounded-md bg-[var(--brand)] text-white font-semibold" data-testid="subtask-save-btn">Add</button>
                </form>
              )}
              {subtasks.length === 0 ? (
                <div className="text-xs text-[var(--text-tertiary)]">No subtasks.</div>
              ) : (
                <ul className="border border-[var(--border-default)] rounded-md divide-y divide-[var(--border-subtle)]">
                  {subtasks.map((s) => (
                    <li key={s.id} className="px-3 py-2 flex items-center gap-2 text-sm hover:bg-[var(--bg-surface-hover)] cursor-pointer" onClick={()=>{ window.history.replaceState(null,"",`${window.location.pathname}?task=${s.id}`); onChanged && onChanged(); window.dispatchEvent(new PopStateEvent("popstate")); }} data-testid={`subtask-${s.id}`}>
                      <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                      <span className="flex-1 truncate">{s.name}</span>
                      <StatusPill status={s.status} />
                      <button onClick={async (e)=>{ e.stopPropagation(); if (!window.confirm("Delete subtask?")) return; await api.delete(`/tasks/${s.id}`).catch(()=>{}); load(); }} className="text-[var(--text-tertiary)] hover:text-red-600" aria-label="Delete subtask" data-testid={`subtask-delete-${s.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Time entries</div>
                <button onClick={() => setShowManual(true)} className="text-xs flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid="task-drawer-add-time"><Plus className="w-3 h-3" /> Manual</button>
              </div>
              {entries.length === 0 ? <div className="text-xs text-[var(--text-tertiary)]">No time logged yet.</div> : (
                <ul className="divide-y divide-[var(--border-subtle)] border border-[var(--border-default)] rounded-md">
                  {entries.map((e) => {
                    const u = userById(e.user_id);
                    return (
                      <li key={e.id} className="px-3 py-2 flex items-center gap-2 text-sm" data-testid={`time-entry-${e.id}`}>
                        {u && <Avatar user={u} size={20} />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{u?.name || "—"} <span className="text-[var(--text-tertiary)] text-xs">· {e.source}</span></div>
                          <div className="text-xs text-[var(--text-tertiary)]">{e.start_time?.slice(0, 16).replace("T", " ")} → {e.end_time?.slice(11, 16)}</div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">{(e.duration_minutes/60).toFixed(2)}h</div>
                        <button onClick={async () => { await api.delete(`/time-entries/${e.id}`).catch(()=>{}); load(); onChanged && onChanged(); }} className="text-[var(--text-tertiary)] hover:text-red-600" aria-label="Delete entry"><Trash2 className="w-3.5 h-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {showManual && <ManualEntryForm taskId={taskId} onClose={() => setShowManual(false)} onSaved={() => { setShowManual(false); load(); onChanged && onChanged(); }} />}
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-2">Comments</div>
              <Comments entityType="task" entityId={taskId} users={users} />
            </section>

            <section className="pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={async ()=>{ if (!window.confirm(`Delete task "${task.name}"?`)) return; await api.delete(`/tasks/${taskId}`).catch(()=>{}); onClose(); onChanged && onChanged(); }}
                className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md flex items-center gap-1.5"
                data-testid="task-drawer-delete"
              ><Trash2 className="w-3.5 h-3.5" /> Delete task</button>
            </section>
          </div>
        )}
      </aside>
    </div>
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

function ManualEntryForm({ taskId, onClose, onSaved }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post("/time-entries", {
        task_id: taskId,
        start_time: `${date}T${start}:00`,
        end_time: `${date}T${end}:00`,
        note,
      });
      onSaved && onSaved();
    } catch { /* noop */ } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-2 p-3 bg-white border border-[var(--border-default)] rounded-md space-y-2 text-sm" data-testid="manual-entry-form">
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="border border-[var(--border-default)] rounded-md px-2 py-1.5" />
        <input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="border border-[var(--border-default)] rounded-md px-2 py-1.5" />
        <input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="border border-[var(--border-default)] rounded-md px-2 py-1.5" />
      </div>
      <input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="What did you work on?" className="w-full border border-[var(--border-default)] rounded-md px-2 py-1.5" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-[var(--brand)] text-white font-semibold disabled:opacity-50" data-testid="manual-entry-save">{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}