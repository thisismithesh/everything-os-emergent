import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui-bits";
import api from "@/lib/api";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!user) return null;

  const save = async (patch) => {
    setBusy(true); setMsg("");
    try { const { data } = await api.patch(`/users/${user.id}`, patch); setUser(data); setMsg("Saved"); setTimeout(()=>setMsg(""),1500); }
    catch (e) { setMsg("Failed"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="Profile" title={user.name} description={user.title || user.role} />
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[var(--border-default)] rounded-md p-5 flex flex-col items-center text-center">
          <Avatar user={user} size={96} />
          <div className="mt-4 text-lg font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{user.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{user.email}</div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{user.role}</div>
          <button onClick={logout} className="mt-6 w-full text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] py-2" data-testid="profile-logout-btn">Log out</button>
        </div>
        <div className="md:col-span-2 bg-white border border-[var(--border-default)] rounded-md p-5 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Details</div>
          <Field label="Name" value={user.name} onSave={(v)=>save({ name: v })} testId="profile-name-input" disabled={busy} />
          <Field label="Title" value={user.title || ""} onSave={(v)=>save({ title: v })} testId="profile-title-input" disabled={busy} />
          <Field label="Team" value={user.team || ""} onSave={(v)=>save({ team: v })} testId="profile-team-input" disabled={busy} />
          <Field label="Avatar URL" value={user.avatar || ""} onSave={(v)=>save({ avatar: v })} testId="profile-avatar-input" disabled={busy} />
          {msg && <div className="text-xs text-[var(--text-secondary)]">{msg}</div>}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onSave, disabled, testId }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center gap-3">
      <label className="w-24 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</label>
      <input value={v} disabled={disabled} onChange={(e)=>setV(e.target.value)} data-testid={testId}
        className="flex-1 border border-[var(--border-default)] rounded-md px-3 py-1.5 text-sm" />
      <button onClick={()=>onSave(v)} disabled={disabled} className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)]" data-testid={`${testId}-save`}>Save</button>
    </div>
  );
}
