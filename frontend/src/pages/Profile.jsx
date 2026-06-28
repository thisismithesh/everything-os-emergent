import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar } from "@/components/ui-bits";
import api from "@/lib/api";
import { Upload, X } from "lucide-react";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  if (!user) return null;

  const save = async (patch) => {
    setBusy(true); setMsg("");
    try { const { data } = await api.patch(`/users/${user.id}`, patch); setUser(data); setMsg("Saved"); setTimeout(()=>setMsg(""),1500); }
    catch (e) { setMsg("Failed"); } finally { setBusy(false); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (1MB = 1048576 bytes)
    if (file.size > 1048576) {
      setMsg("Image must be less than 1MB");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setMsg("Only JPG, PNG, and WebP files are allowed");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result;
        await save({ avatar: base64 });
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setMsg("Upload failed");
      setUploadingAvatar(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Profile" title={user.name} description={user.title || user.role} />
      <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[var(--border-default)] rounded-md p-5 flex flex-col items-center text-center">
          <div className="relative">
            <Avatar user={user} size={96} />
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[var(--brand)] text-white flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity" data-testid="profile-avatar-upload-btn" title="Upload avatar">
              <Upload className="w-4 h-4" />
              <input 
                type="file" 
                hidden 
                accept="image/jpeg,image/png,image/webp" 
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                data-testid="profile-avatar-file-input"
              />
            </label>
          </div>
          <div className="mt-4 text-lg font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{user.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{user.email}</div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{user.role}</div>
          {user.avatar && (
            <button 
              onClick={() => save({ avatar: null })} 
              className="mt-2 text-xs text-[var(--text-tertiary)] hover:text-red-600 flex items-center gap-1"
              data-testid="profile-avatar-remove-btn"
            >
              <X className="w-3 h-3" /> Remove avatar
            </button>
          )}
          <button onClick={logout} className="mt-6 w-full text-sm rounded-md border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] py-2" data-testid="profile-logout-btn">Log out</button>
        </div>
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-[var(--border-default)] rounded-md p-5 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Details</div>
            <Field label="Name" value={user.name} onSave={(v)=>save({ name: v })} testId="profile-name-input" disabled={busy} />
            <Field label="Title" value={user.title || ""} onSave={(v)=>save({ title: v })} testId="profile-title-input" disabled={busy} />
            <Field label="Team" value={user.team || ""} onSave={(v)=>save({ team: v })} testId="profile-team-input" disabled={busy} />
            {uploadingAvatar && <div className="text-xs text-[var(--text-secondary)]">Uploading avatar...</div>}
            {msg && <div className="text-xs text-[var(--text-secondary)]">{msg}</div>}
          </div>

          {(user.role === "leadership" || user.role === "manager") && (
            <div className="bg-white border border-[var(--border-default)] rounded-md p-5 space-y-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">App Settings</div>
              <AppIconUpload />
            </div>
          )}
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

function AppIconUpload() {
  const [appIcon, setAppIcon] = useState(localStorage.getItem("app_heading_icon") || "");
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (1MB = 1048576 bytes)
    if (file.size > 1048576) {
      setMsg("Icon must be less than 1MB");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setMsg("Only JPG, PNG, WebP, and SVG files are allowed");
      setTimeout(() => setMsg(""), 2000);
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result;
        localStorage.setItem("app_heading_icon", base64);
        setAppIcon(base64);
        setMsg("Icon updated! Reload page to see changes.");
        setTimeout(() => setMsg(""), 3000);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setMsg("Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 border border-[var(--border-default)] rounded-md bg-[var(--bg-surface-hover)]">
        <div className="w-12 h-12 rounded-sm flex items-center justify-center bg-white border border-[var(--border-default)]">
          {appIcon ? (
            <img src={appIcon} alt="App icon" className="w-full h-full object-contain rounded-sm" />
          ) : (
            <span className="text-lg font-black text-[var(--brand)]" style={{ fontFamily: "'Cabinet Grotesk'" }}>E</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">App Heading Icon</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">Max 1MB (JPG, PNG, WebP, SVG)</div>
        </div>
        <label className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-default)] hover:bg-white cursor-pointer transition-colors" data-testid="profile-app-icon-upload-btn">
          Upload
          <input 
            type="file" 
            hidden 
            accept="image/jpeg,image/png,image/webp,image/svg+xml" 
            onChange={handleIconUpload}
            disabled={uploading}
            data-testid="profile-app-icon-file-input"
          />
        </label>
      </div>
      {appIcon && (
        <button 
          onClick={() => {
            localStorage.removeItem("app_heading_icon");
            setAppIcon("");
            setMsg("Icon removed! Reload page to see changes.");
            setTimeout(() => setMsg(""), 3000);
          }}
          className="text-xs text-[var(--text-tertiary)] hover:text-red-600 flex items-center gap-1"
          data-testid="profile-app-icon-remove-btn"
        >
          <X className="w-3 h-3" /> Reset to default
        </button>
      )}
      {uploading && <div className="text-xs text-[var(--text-secondary)]">Uploading icon...</div>}
      {msg && <div className="text-xs text-[var(--text-secondary)]">{msg}</div>}
    </div>
  );
}
