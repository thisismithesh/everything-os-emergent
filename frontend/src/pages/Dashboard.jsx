import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import GanttTimeline from "@/components/GanttTimeline";

const TYPE_LABEL = { billable_regular: "Billable", billable_retainer: "Retainer", non_billable: "Non-billable" };

export default function Dashboard() {
  const [data, setData] = useState({ projects: [], users: [], leaves: [], member_blocks: [] });
  useEffect(() => { api.get("/dashboard/gantt").then((r)=>setData(r.data)).catch(()=>{}); }, []);

  const projects = data.projects.filter((p)=>p.start_date && p.end_date);
  const users = data.users;

  const stats = {
    activeProjects: projects.filter((p)=> p.status !== "completed").length,
    onTrack: projects.filter((p)=> p.health === "on_track").length,
    atRisk: projects.filter((p)=> p.health === "at_risk" || p.health === "off_track").length,
    teamSize: users.length,
  };

  const teamRows = users.map((u) => {
    const blocks = (data.member_blocks || []).filter((b)=>b.user_id===u.id && b.start_date && b.end_date);
    const lvs = (data.leaves || []).filter((l)=>l.user_id===u.id);
    return {
      id: u.id,
      label: u.name,
      sublabel: u.team || u.role,
      segments: blocks.map((b) => ({
        start: b.start_date,
        end: b.end_date,
        color: "#2563EB",
        title: b.project_name,
        onClick: () => b.project_id && window.location.assign(`/projects/${b.project_id}`),
      })),
      secondary: lvs.map((l) => ({
        start: l.start_date,
        end: l.end_date,
        color: "#FBBF24",
        title: `Leave (${l.type})`,
      })),
    };
  });

  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Overview" description="Project + team timelines, at a glance." />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label="Active projects" value={stats.activeProjects} />
          <Kpi label="On track" value={stats.onTrack} accent="#10B981" />
          <Kpi label="Needs attention" value={stats.atRisk} accent="#F59E0B" />
          <Kpi label="Team size" value={stats.teamSize} />
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Project timelines</h3>
          </div>
          <GanttTimeline
            rows={projects.map((p) => ({
              id: p.id,
              label: p.name,
              sublabel: TYPE_LABEL[p.type],
              start: p.start_date,
              end: p.end_date,
              color: p.health === "on_track" ? "#0A0A0A" : p.health === "at_risk" ? "#F59E0B" : "#EF4444",
              onClick: () => window.location.assign(`/projects/${p.id}`),
            }))}
            onPatch={async (pid, { start, end }) => {
              const target = data.projects.find((x)=>x.id===pid);
              if (!target) return;
              const body = { ...target, start_date: start, end_date: end };
              delete body.id; delete body.share_token; delete body.public_enabled; delete body.created_at;
              await api.patch(`/projects/${pid}`, body).catch(()=>{});
              const r = await api.get("/dashboard/gantt").catch(()=>({data:{}}));
              if (r.data) setData(r.data);
            }}
            emptyMessage="No project timelines yet."
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Team timelines</h3>
          </div>
          <GanttTimeline
            rows={teamRows}
            editable={false}
            emptyMessage="No team members or assignments yet."
          />
          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{background:"#2563EB"}} /> Project</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{background:"#FBBF24"}} /> Leave</span>
          </div>
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md p-4">
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'", color: accent || "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
