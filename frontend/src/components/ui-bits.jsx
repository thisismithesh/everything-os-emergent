// Small UI primitives used across pages.
export function StatusPill({ status }) {
  const map = {
    todo:        { bg: "#F4F4F5", fg: "#3F3F46", label: "To do" },
    in_progress: { bg: "#DBEAFE", fg: "#1E40AF", label: "In progress" },
    review:      { bg: "#FEF3C7", fg: "#92400E", label: "In review" },
    done:        { bg: "#D1FAE5", fg: "#065F46", label: "Done" },
    blocked:     { bg: "#FEE2E2", fg: "#991B1B", label: "Blocked" },
    planning:    { bg: "#F4F4F5", fg: "#3F3F46", label: "Planning" },
    on_hold:     { bg: "#FEF3C7", fg: "#92400E", label: "On hold" },
    completed:   { bg: "#D1FAE5", fg: "#065F46", label: "Completed" },
  };
  const s = map[status] || { bg: "#F4F4F5", fg: "#3F3F46", label: status || "—" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

export function PriorityPill({ priority }) {
  const map = {
    high:   { bg: "#FEE2E2", fg: "#991B1B", label: "High" },
    medium: { bg: "#FEF3C7", fg: "#92400E", label: "Medium" },
    low:    { bg: "#F4F4F5", fg: "#3F3F46", label: "Low" },
  };
  const s = map[priority] || { bg: "#F4F4F5", fg: "#3F3F46", label: priority || "—" };
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

export function HealthDot({ health }) {
  const map = {
    on_track: { c: "#10B981", label: "On track" },
    at_risk:  { c: "#F59E0B", label: "At risk" },
    off_track:{ c: "#EF4444", label: "Off track" },
  };
  const s = map[health] || { c: "#A1A1AA", label: "—" };
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
      <span className="w-2 h-2 rounded-full" style={{ background: s.c }} />
      {s.label}
    </span>
  );
}

export function Avatar({ user, size = 24 }) {
  if (!user) return null;
  const initials = (user.name || user.email || "?")
    .split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (user.avatar) {
    return (
      <img
        src={user.avatar} alt={user.name || ""}
        className="rounded-full object-cover ring-2 ring-white"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--bg-surface-active)] text-[var(--text-primary)] text-[10px] font-semibold ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = 24 }) {
  if (!users || users.length === 0) return <span className="text-xs text-[var(--text-tertiary)]">—</span>;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-white border border-[var(--border-default)] text-[10px] text-[var(--text-secondary)]"
          style={{ width: size, height: size }}
        >+{extra}</span>
      )}
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="border border-dashed border-[var(--border-default)] rounded-md p-10 text-center bg-white">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      {hint && <div className="text-sm text-[var(--text-secondary)] mt-1">{hint}</div>}
    </div>
  );
}
