import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "@/lib/api";
import { Avatar, StatusPill, PriorityPill, HealthDot, Empty } from "@/components/ui-bits";

const TYPE_LABEL = { billable_regular: "Billable", billable_retainer: "Retainer", non_billable: "Non-billable" };

export default function PublicProject() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/public/projects/${token}`)
      .then((r)=>setData(r.data))
      .catch((e)=>setErr(e.response?.data?.detail || "Not found or not public"));
  }, [token]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">Studio PM · Public link</div>
        <h2 className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Project not available</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-2">{String(err)}</p>
      </div>
    </div>
  );
  if (!data) return <div className="p-8 text-sm text-[var(--text-tertiary)]">Loading…</div>;
  const { project, tasks, events, members, client } = data;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-[var(--border-default)] sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[var(--brand)] rounded-sm flex items-center justify-center">
              <span className="text-white text-xs font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>S</span>
            </div>
            <div className="text-xs font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>Studio PM</div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">Public view</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">{TYPE_LABEL[project.type]}{client ? " · " + client.company : ""}</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{project.name}</h1>
          {project.brief && <p className="mt-3 text-base text-[var(--text-secondary)] max-w-2xl">{project.brief}</p>}
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <StatusPill status={project.status} />
            <PriorityPill priority={project.priority} />
            <HealthDot health={project.health} />
            <div className="text-xs text-[var(--text-tertiary)]">{project.start_date || "—"} → {project.end_date || "—"}</div>
          </div>
        </section>

        {members.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold mb-3">Team</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {members.map((m)=>(
                <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white border border-[var(--border-default)] rounded-md">
                  <Avatar user={m} size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] truncate">{m.role || m.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold mb-3">Milestones & tasks</div>
          {tasks.length === 0 ? <Empty title="No tasks shared" /> : (
            <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface-hover)] border-b border-[var(--border-default)] text-left">
                  <tr className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">
                    <th className="px-4 py-2">Task</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t)=>(
                    <tr key={t.id} className="border-b border-[var(--border-subtle)]">
                      <td className="px-4 py-3">{t.name}</td>
                      <td className="px-4 py-3"><StatusPill status={t.status} /></td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{t.latest_deadline || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {events.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold mb-3">Events</div>
            <ul className="divide-y divide-[var(--border-subtle)] bg-white border border-[var(--border-default)] rounded-md">
              {events.map((e)=>(
                <li key={e.id} className="px-4 py-3 text-sm flex justify-between">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-[var(--text-secondary)]">{e.date} · {e.time || "—"}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="pt-8 text-xs text-[var(--text-tertiary)] text-center">Powered by Studio PM</footer>
      </main>
    </div>
  );
}
