import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import api from "@/lib/api";
import { Link } from "react-router-dom";

const TYPE_LABEL = {
  task_assigned: "Assignment",
  task_status_changed: "Status",
  comment_new: "Comment",
  comment_mention: "Mention",
  project_status_changed: "Project status",
  project_health_changed: "Project health",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = () => api.get("/notifications").then((r) => setData(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const markRead = async (n) => {
    if (!n.read) {
      await api.post(`/notifications/${n.id}/read`).catch(() => {});
      load();
    }
  };
  const markAll = async () => { await api.post("/notifications/read-all").catch(() => {}); load(); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="notif-bell-btn"
        className="relative p-2 rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {data.unread > 0 && (
          <span data-testid="notif-unread-count" className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute left-full top-0 ml-2 w-80 bg-white border border-[var(--border-default)] rounded-md shadow-lg z-50 overflow-hidden"
          data-testid="notif-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Notifications</div>
            {data.unread > 0 && (
              <button onClick={markAll} className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)]" data-testid="notif-mark-all-read">Mark all read</button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {data.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--text-tertiary)]">You&apos;re all caught up.</div>
            ) : (
              data.items.map((n) => {
                const inner = (
                  <>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-[var(--accent)]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{TYPE_LABEL[n.type] || n.type}</div>
                        <div className="text-sm text-[var(--text-primary)] leading-snug">{n.message}</div>
                        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </>
                );
                const cls = `block px-4 py-3 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] cursor-pointer ${n.read ? "" : "bg-[var(--bg-surface-hover)]/50"}`;
                return n.link ? (
                  <Link key={n.id} to={n.link} className={cls} onClick={() => { markRead(n); setOpen(false); }} data-testid={`notif-item-${n.id}`}>{inner}</Link>
                ) : (
                  <div key={n.id} className={cls} onClick={() => markRead(n)} data-testid={`notif-item-${n.id}`}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
