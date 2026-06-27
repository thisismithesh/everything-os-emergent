import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import api from "@/lib/api";
import { Avatar, StatusPill } from "@/components/ui-bits";
import GanttTimeline from "@/components/GanttTimeline";

const TYPE_LABEL = { billable_regular: "Billable", billable_retainer: "Retainer", non_billable: "Non-billable" };

export default function Dashboard() {
  const [data, setData] = useState({ projects: [], users: [], leaves: [], member_blocks: [] });
  useEffect(() => { api.get("/dashboard/gantt").then((r)=>setData(r.data)).catch(()=>{}); }, []);

  const projects = data.projects.filter((p)=>p.start_date && p.end_date);
  const users = data.users;

  const dateRange = useMemo(() => {
    const all = [
      ...projects.flatMap((p)=>[p.start_date, p.end_date]),
      ...data.leaves.flatMap((l)=>[l.start_date, l.end_date]),
      ...data.member_blocks.flatMap((m)=>[m.start_date, m.end_date]).filter(Boolean),
    ].filter(Boolean);
    if (all.length === 0) return [];
    const min = new Date(all.reduce((a,b)=> a<b?a:b)); min.setDate(min.getDate()-3);
    const max = new Date(all.reduce((a,b)=> a>b?a:b)); max.setDate(max.getDate()+3);
    const out = []; for (let d=new Date(min); d<=max; d.setDate(d.getDate()+1)) out.push(new Date(d));
    return out;
  }, [projects, data.leaves, data.member_blocks]);

  const colW = 16;
  const start = dateRange[0];
  const idx = (iso) => iso ? Math.round((new Date(iso) - start) / (1000*60*60*24)) : 0;

  const stats = {
    activeProjects: projects.filter((p)=> p.status !== "completed").length,
    onTrack: projects.filter((p)=> p.health === "on_track").length,
    atRisk: projects.filter((p)=> p.health === "at_risk" || p.health === "off_track").length,
    teamSize: users.length,
  };

  const todayIdx = dateRange.length ? Math.round((new Date() - start) / (1000*60*60*24)) : -1;

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
        <section className="bg-white border border-[var(--border-default)] rounded-md p-5" style={{display:"none"}}>
          <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Project timelines (legacy)</h3>
          <div className="mt-3 overflow-x-auto">
            {dateRange.length === 0 ? <div className="text-sm text-[var(--text-tertiary)]">No timeline data.</div> : (
              <div className="min-w-fit">
                <div className="flex border-b border-[var(--border-default)] sticky top-0 bg-white z-10">
                  <div className="w-64 shrink-0 px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold border-r border-[var(--border-default)]">Project</div>
                  <div className="flex">
                    {dateRange.map((d,i)=> (
                      <div key={i} className="text-[10px] text-[var(--text-tertiary)] text-center border-r border-[var(--border-subtle)] py-2" style={{ width: colW }}>
                        {d.getDate()===1 || i===0 ? d.toLocaleDateString(undefined,{month:"short"}) : (d.getDay()===1 ? d.getDate() : "")}
                      </div>
                    ))}
                  </div>
                </div>
                {projects.map((p) => {
                  const s = idx(p.start_date), e = idx(p.end_date);
                  const w = Math.max(1, (e - s + 1)) * colW;
                  return (
                    <div key={p.id} className="flex items-center border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]">
                      <div className="w-64 shrink-0 px-3 py-3 border-r border-[var(--border-default)]">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">{TYPE_LABEL[p.type]}</div>
                      </div>
                      <div className="relative" style={{ width: dateRange.length * colW, height: 36 }}>
                        {todayIdx >= 0 && (
                          <div className="absolute top-0 bottom-0 w-px bg-[var(--accent)]/40" style={{ left: todayIdx*colW }} />
                        )}
                        <div className="absolute top-1/2 -translate-y-1/2 rounded-sm" style={{ left: s*colW, width: w, height: 16, background: p.health === "on_track" ? "#0A0A0A" : p.health === "at_risk" ? "#F59E0B" : "#EF4444" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white border border-[var(--border-default)] rounded-md p-5">
          <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Team timelines</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Project blocks per team member, with leaves overlaid.</p>
          <div className="mt-3 overflow-x-auto">
            {dateRange.length === 0 ? <div className="text-sm text-[var(--text-tertiary)]">No data.</div> : (
              <div className="min-w-fit">
                <div className="flex border-b border-[var(--border-default)] sticky top-0 bg-white z-10">
                  <div className="w-64 shrink-0 px-3 py-2 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold border-r border-[var(--border-default)]">Member</div>
                  <div className="flex">
                    {dateRange.map((d,i)=> (
                      <div key={i} className="text-[10px] text-[var(--text-tertiary)] text-center border-r border-[var(--border-subtle)] py-2" style={{ width: colW }}>
                        {d.getDate()===1 || i===0 ? d.toLocaleDateString(undefined,{month:"short"}) : (d.getDay()===1 ? d.getDate() : "")}
                      </div>
                    ))}
                  </div>
                </div>
                {users.map((u) => {
                  const blocks = data.member_blocks.filter((b)=>b.user_id===u.id && b.start_date && b.end_date);
                  const lvs = data.leaves.filter((l)=>l.user_id===u.id);
                  return (
                    <div key={u.id} className="flex items-center border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]">
                      <div className="w-64 shrink-0 px-3 py-3 border-r border-[var(--border-default)] flex items-center gap-2">
                        <Avatar user={u} size={26} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{u.name}</div>
                          <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">{u.team || u.role}</div>
                        </div>
                      </div>
                      <div className="relative" style={{ width: dateRange.length * colW, height: 36 }}>
                        {todayIdx >= 0 && <div className="absolute top-0 bottom-0 w-px bg-[var(--accent)]/40" style={{ left: todayIdx*colW }} />}
                        {blocks.map((b, i) => {
                          const s = idx(b.start_date), e = idx(b.end_date);
                          const w = Math.max(1, (e - s + 1)) * colW;
                          return (
                            <div key={i} title={b.project_name} className="absolute rounded-sm text-[10px] text-white px-1 overflow-hidden whitespace-nowrap"
                              style={{ left: s*colW, width: w, height: 12, top: 8, background: "#2563EB" }}>
                              {w > 60 ? b.project_name : ""}
                            </div>
                          );
                        })}
                        {lvs.map((l, i) => {
                          const s = idx(l.start_date), e = idx(l.end_date);
                          const w = Math.max(1, (e - s + 1)) * colW;
                          return (
                            <div key={i} className="absolute rounded-sm" title={`Leave (${l.type})`}
                              style={{ left: s*colW, width: w, height: 12, bottom: 6, background: "#FBBF24" }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{background:"#2563EB"}} /> Project</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{background:"#FBBF24"}} /> Leave</span>
            <span className="flex items-center gap-1.5"><span className="w-px h-3" style={{background:"#2563EB"}} /> Today</span>
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
