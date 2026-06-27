import { useState } from "react";
import { X } from "lucide-react";
import api from "@/lib/api";

export default function AddLeaveModal({ userId, onClose, onSaved }) {
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState("vacation");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.post("/leaves", { user_id: userId, start_date: start, end_date: end, type, note });
      onSaved && onSaved(); onClose();
    } catch (e2) { setErr(e2.response?.data?.detail || "Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="add-leave-modal">
      <div className="bg-white rounded-md border border-[var(--border-default)] w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Log time off</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-surface-hover)]" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">From</div>
              <input required type="date" value={start} onChange={(e)=>setStart(e.target.value)} data-testid="leave-start-input"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
            </label>
            <label className="block">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">To</div>
              <input required type="date" value={end} onChange={(e)=>setEnd(e.target.value)} data-testid="leave-end-input"
                className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" />
            </label>
          </div>
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Type</div>
            <select value={type} onChange={(e)=>setType(e.target.value)} data-testid="leave-type-select"
              className="w-full border border-[var(--border-default)] rounded-md px-3 py-2">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">Note (optional)</div>
            <input value={note} onChange={(e)=>setNote(e.target.value)}
              className="w-full border border-[var(--border-default)] rounded-md px-3 py-2" data-testid="leave-note-input" />
          </label>
          {err && <div className="text-xs text-red-700">{String(err)}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 bg-[var(--brand)] text-white rounded-md font-semibold hover:bg-[var(--brand-hover)] disabled:opacity-50" data-testid="leave-save-btn">{busy?"Saving…":"Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
