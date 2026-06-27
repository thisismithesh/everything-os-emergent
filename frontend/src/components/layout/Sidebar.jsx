import { NavLink, useLocation } from "react-router-dom";
import { TABS } from "@/contexts/AuthContext";
import {
  Calendar, ListChecks, FolderKanban, Users, Building2, Megaphone,
  Briefcase, Building, LayoutDashboard, Wallet, User as UserIcon, LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ICONS = {
  calendar: Calendar, tasks: ListChecks, projects: FolderKanban, team: Users,
  clients: Building2, marketing: Megaphone, sales: Briefcase, company: Building,
  dashboard: LayoutDashboard, financials: Wallet,
};

const GROUPS = [
  ["calendar", "tasks", "projects"],
  ["team", "clients"],
  ["marketing", "sales", "company"],
  ["dashboard", "financials"],
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  if (!user) return null;

  const visible = (k) => {
    const t = TABS.find((x) => x.key === k);
    return t && t.roles.includes(user.role);
  };

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 border-r border-[var(--border-default)] bg-white h-screen sticky top-0"
      data-testid="sidebar"
    >
      <div className="px-6 py-5 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--brand)] rounded-sm flex items-center justify-center">
            <span className="text-white text-sm font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>S</span>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Studio PM</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Design Agency</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {GROUPS.map((group, gi) => {
          const items = group.filter(visible);
          if (items.length === 0) return null;
          return (
            <div key={gi} className="space-y-0.5">
              {items.map((key) => {
                const t = TABS.find((x) => x.key === key);
                const Icon = ICONS[key];
                const path = `/${key}`;
                const active = location.pathname === path || location.pathname.startsWith(path + "/");
                return (
                  <NavLink
                    key={key}
                    to={path}
                    data-testid={`sidebar-${key}-link`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                    <span>{t.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border-default)] p-3 space-y-1">
        <NavLink
          to="/profile"
          data-testid="sidebar-profile-link"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            }`
          }
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <UserIcon className="w-4 h-4" strokeWidth={1.75} />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{user.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{user.role}</div>
          </div>
        </NavLink>
        <button
          data-testid="sidebar-logout-btn"
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
