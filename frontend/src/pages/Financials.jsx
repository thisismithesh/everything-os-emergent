import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Empty } from "@/components/ui-bits";

const TYPE_LABEL = {
  billable_regular: "Billable",
  billable_retainer: "Retainer",
  non_billable: "Non-billable",
};

const fmtINR = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtHrs = (n) => `${(n || 0).toFixed(1)}h`;
const fmtPct = (n) => (n == null ? "—" : `${n}%`);

export default function Financials() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get("/financials/overview")
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || "Failed to load financials"));
  }, []);

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    []
  );

  return (
    <>
      <PageHeader
        eyebrow="Financials"
        title="Financial overview"
        description={`Earned revenue, project P&L and team utilization — ${monthLabel}`}
      />
      <div className="p-8 space-y-8">
        {err && <div className="text-sm text-red-700">{err}</div>}
        {!data && !err && <div className="text-sm text-[var(--text-tertiary)]">Loading…</div>}
        {data && (
          <>
            <Kpis k={data.kpis} />
            <ProjectsTable rows={data.projects} />
            <TeamTable rows={data.team} />
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ label, hint, value, accent }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-4" data-testid={`fin-kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'", color: accent || "var(--text-primary)" }}>{value}</div>
      {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</div>}
    </div>
  );
}

function Kpis({ k }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" data-testid="fin-kpis">
      <Kpi label="Earned revenue (MTD)" value={fmtINR(k.earned_revenue_mtd)} hint="Hours × rate, capped at project budget." accent="#10B981" />
      <Kpi label="Billable hours (MTD)" value={fmtHrs(k.billable_hours_mtd)} hint="Client-facing work this month." />
      <Kpi label="Internal hours (MTD)" value={fmtHrs(k.internal_hours_mtd)} hint="Non-billable / studio work." accent="#F59E0B" />
      <Kpi label="Outstanding project value" value={fmtINR(k.outstanding_value)} hint="Budget remaining across ongoing billable projects." />
    </div>
  );
}

function HealthBar({ pct }) {
  if (pct == null) return <div className="text-[10px] text-[var(--text-tertiary)]">—</div>;
  const color = pct < 70 ? "#10B981" : pct < 95 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--bg-surface-hover)] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-10 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function ProjectsTable({ rows }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Project P&amp;L</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Billable projects show earned revenue capped at budget. Non-billable show effort only.</p>
        </div>
      </div>
      {rows.length === 0 ? <Empty title="No projects yet" /> : (
        <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
          <table className="w-full text-sm" data-testid="fin-projects-table">
            <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
              <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                <th className="px-4 py-2.5">Project</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5 text-right">Budget</th>
                <th className="px-4 py-2.5 text-right">Hours</th>
                <th className="px-4 py-2.5 text-right">Earned</th>
                <th className="px-4 py-2.5 text-right">Remaining</th>
                <th className="px-4 py-2.5 w-40">Budget used</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`fin-project-row-${r.id}`}>
                  <td className="px-4 py-3">
                    <a href={`/projects/${r.id}`} className="font-medium hover:underline">{r.name}</a>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3 text-right">{r.billable ? (r.budget > 0 ? fmtINR(r.budget) : <span className="text-[var(--text-tertiary)]">—</span>) : <span className="text-[var(--text-tertiary)]">N/A</span>}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{fmtHrs(r.hours_total)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.billable ? fmtINR(r.earned_total) : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{r.billable && r.budget > 0 ? fmtINR(r.remaining) : <span className="text-[var(--text-tertiary)]">—</span>}</td>
                  <td className="px-4 py-3"><HealthBar pct={r.percent_used} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TeamTable({ rows }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Team utilization &amp; revenue (MTD)</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Hours logged this month and ₹ generated. Set each member&apos;s hourly rate on the Team page.</p>
        </div>
      </div>
      {rows.length === 0 ? <Empty title="No team members yet" /> : (
        <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
          <table className="w-full text-sm" data-testid="fin-team-table">
            <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
              <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                <th className="px-4 py-2.5">Member</th>
                <th className="px-4 py-2.5">Team</th>
                <th className="px-4 py-2.5 text-right">Rate / h</th>
                <th className="px-4 py-2.5 text-right">Billable hrs</th>
                <th className="px-4 py-2.5 text-right">Internal hrs</th>
                <th className="px-4 py-2.5 text-right">Revenue</th>
                <th className="px-4 py-2.5 w-40">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`fin-team-row-${r.id}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{r.role}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{r.team || "—"}</td>
                  <td className="px-4 py-3 text-right">{r.hourly_rate > 0 ? fmtINR(r.hourly_rate) : <span className="text-[var(--text-tertiary)]">— set rate</span>}</td>
                  <td className="px-4 py-3 text-right">{fmtHrs(r.hours_billable_mtd)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{fmtHrs(r.hours_internal_mtd)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtINR(r.revenue_mtd)}</td>
                  <td className="px-4 py-3"><HealthBar pct={r.utilization} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
