// Reusable Gantt timeline used by Projects, Project tasks, and Dashboard.
// - Clean date header (month band + day band, weekend tint)
// - Vertical "today" line + recenter button
// - Bars: drag body to MOVE only (no expand), drag left/right edge to RESIZE that side
// - Closure-safe refs so onUp uses the final position

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * rows: [{ id, label, sublabel?, start, end, color?, secondary?: [{start,end,color,title?}], onClick?:fn }]
 * onPatch(rowId, { start, end }) called on drop after move/resize
 * editable: boolean — disables drag handlers when false
 * todayAccent: string (color)
 */
export default function GanttTimeline({ rows, onPatch, editable = true, padDays = 14, rowHeight = 38, labelWidth = 240, colW = 28, todayAccent = "#2563EB", emptyMessage = "Nothing to show on the timeline yet." }) {
  const scrollerRef = useRef(null);
  const todayRef = useRef(null);

  const dates = useMemo(() => {
    const all = rows.flatMap((r) => [
      r.start, r.end,
      ...(r.segments || []).flatMap((s) => [s.start, s.end]),
      ...(r.secondary || []).flatMap((s) => [s.start, s.end]),
    ].filter(Boolean));
    let min, max;
    if (all.length === 0) {
      const t = new Date(); t.setHours(0,0,0,0);
      min = new Date(t); min.setDate(t.getDate() - padDays);
      max = new Date(t); max.setDate(t.getDate() + padDays);
    } else {
      min = new Date(all.reduce((a, b) => a < b ? a : b));
      max = new Date(all.reduce((a, b) => a > b ? a : b));
      min.setDate(min.getDate() - padDays);
      max.setDate(max.getDate() + padDays);
    }
    const out = [];
    for (let d = new Date(min); d <= max; d.setDate(d.getDate()+1)) out.push(new Date(d));
    return out;
  }, [rows, padDays]);

  const start = dates[0];
  const todayIdx = useMemo(() => {
    if (!start) return -1;
    const t = new Date(); t.setHours(0,0,0,0);
    return Math.round((t - start) / 86400000);
  }, [start]);

  // group by month for the top band
  const monthBands = useMemo(() => {
    const out = [];
    let cur = null;
    dates.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!cur || cur.key !== key) {
        cur = { key, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), startIdx: i, count: 1 };
        out.push(cur);
      } else {
        cur.count += 1;
      }
    });
    return out;
  }, [dates]);

  // Recenter on today
  const recenter = () => {
    const el = scrollerRef.current;
    if (!el || todayIdx < 0) return;
    const target = todayIdx * colW - el.clientWidth / 2 + labelWidth / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };
  useEffect(() => { recenter(); /* eslint-disable-next-line */ }, []);

  const idxOf = (iso) => Math.round((new Date(iso) - start) / 86400000);
  const dateAt = (i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0,10);
  };

  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-[var(--border-default)] rounded-md p-10 text-center bg-white">
        <div className="text-sm text-[var(--text-secondary)]">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-md overflow-hidden" data-testid="gantt-timeline">
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-surface-hover)]">
        <button
          onClick={recenter}
          className="text-xs px-2.5 py-1 rounded-md border border-[var(--border-default)] bg-white hover:bg-[var(--bg-surface-hover)] inline-flex items-center gap-1.5"
          data-testid="gantt-today-btn"
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: todayAccent }} />
          Today
        </button>
      </div>
      <div ref={scrollerRef} className="overflow-x-auto" style={{ maxHeight: "65vh" }}>
        <div style={{ width: labelWidth + dates.length * colW, minWidth: "100%" }}>
          {/* Header — month band */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-[var(--border-default)]">
            <div className="shrink-0 bg-white border-r border-[var(--border-default)]" style={{ width: labelWidth }} />
            <div className="relative flex" style={{ width: dates.length * colW }}>
              {monthBands.map((m) => (
                <div key={m.key}
                  className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-r border-[var(--border-default)] bg-white sticky"
                  style={{ width: m.count * colW }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
          {/* Header — day band */}
          <div className="flex sticky z-10 bg-white border-b border-[var(--border-default)]" style={{ top: 24 }}>
            <div className="shrink-0 bg-white border-r border-[var(--border-default)] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold" style={{ width: labelWidth }}>
              Item
            </div>
            <div className="relative flex" style={{ width: dates.length * colW }}>
              {dates.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const isToday = i === todayIdx;
                return (
                  <div key={i}
                    ref={isToday ? todayRef : null}
                    className={`text-[10px] text-center border-r py-1.5 ${isWeekend ? "bg-[var(--bg-surface-hover)]" : "bg-white"} ${isToday ? "font-bold" : ""}`}
                    style={{ width: colW, borderColor: "var(--border-subtle)", color: isToday ? todayAccent : "var(--text-tertiary)" }}
                  >
                    <div className="text-[9px] uppercase">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</div>
                    <div>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Rows */}
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              start={start}
              colW={colW}
              labelWidth={labelWidth}
              totalCols={dates.length}
              rowHeight={rowHeight}
              idxOf={idxOf}
              dateAt={dateAt}
              todayIdx={todayIdx}
              todayAccent={todayAccent}
              editable={editable}
              onPatch={onPatch}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ row, start, colW, labelWidth, totalCols, rowHeight, idxOf, dateAt, todayIdx, todayAccent, editable, onPatch }) {
  const hasMainBar = !!(row.start && row.end);
  const initLeft = hasMainBar ? idxOf(row.start) : 0;
  const initEnd = hasMainBar ? idxOf(row.end) : initLeft + 3;
  const initWidth = Math.max(1, initEnd - initLeft + 1);

  const [lp, setLp] = useState(initLeft);
  const [wd, setWd] = useState(initWidth);
  const lpRef = useRef(initLeft);
  const wdRef = useRef(initWidth);
  const drag = useRef(null);
  const moved = useRef(false);

  useEffect(() => {
    setLp(initLeft); setWd(initWidth);
    lpRef.current = initLeft; wdRef.current = initWidth;
  }, [initLeft, initWidth]);

  const beginDrag = (mode) => (e) => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    moved.current = false;
    drag.current = { mode, startX: e.clientX, l0: lpRef.current, w0: wdRef.current };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.startX;
    const cells = Math.round(dx / colW);
    if (Math.abs(dx) > 3) moved.current = true;
    if (drag.current.mode === "move") {
      const next = Math.max(0, Math.min(totalCols - drag.current.w0, drag.current.l0 + cells));
      lpRef.current = next; setLp(next);
    } else if (drag.current.mode === "resize-right") {
      const next = Math.max(1, Math.min(totalCols - drag.current.l0, drag.current.w0 + cells));
      wdRef.current = next; setWd(next);
    } else if (drag.current.mode === "resize-left") {
      // shrink/grow from left: keep right edge fixed
      const rightEdge = drag.current.l0 + drag.current.w0;
      const nextLeft = Math.max(0, Math.min(rightEdge - 1, drag.current.l0 + cells));
      const nextWidth = rightEdge - nextLeft;
      lpRef.current = nextLeft; wdRef.current = nextWidth;
      setLp(nextLeft); setWd(nextWidth);
    }
  };

  const onUp = async () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!moved.current) {
      // Treat as click on bar
      row.onClick && row.onClick();
      return;
    }
    const newStart = dateAt(lpRef.current);
    const newEnd = dateAt(lpRef.current + wdRef.current - 1);
    onPatch && (await onPatch(row.id, { start: newStart, end: newEnd }));
  };

  const color = row.color || "#0A0A0A";

  return (
    <div className="flex items-stretch border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)]" data-testid={`gantt-row-${row.id}`}>
      <div
        className="shrink-0 px-3 py-2 border-r border-[var(--border-default)] cursor-pointer"
        style={{ width: labelWidth }}
        onClick={() => row.onClick && row.onClick()}
      >
        <div className="text-sm font-medium truncate text-[var(--text-primary)]">{row.label}</div>
        {row.sublabel && <div className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold truncate">{row.sublabel}</div>}
      </div>
      <div className="relative" style={{ width: totalCols * colW, height: rowHeight }} data-testid={`gantt-track-${row.id}`}>
        {/* weekend tint background */}
        {Array.from({ length: totalCols }).map((_, i) => {
          const d = new Date(start); d.setDate(start.getDate()+i);
          const w = d.getDay() === 0 || d.getDay() === 6;
          if (!w) return null;
          return <div key={i} className="absolute top-0 bottom-0 bg-[var(--bg-surface-hover)]/60" style={{ left: i*colW, width: colW }} />;
        })}
        {/* today line */}
        {todayIdx >= 0 && (
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: todayIdx * colW + colW / 2 - 0.5, width: 1, background: todayAccent }} />
        )}
        {/* secondary blocks (e.g., leaves) */}
        {(row.secondary || []).map((s, i) => {
          const a = idxOf(s.start), b = idxOf(s.end);
          const left = Math.max(0, Math.min(totalCols-1, a));
          const w = Math.max(1, b - a + 1);
          return (
            <div key={i}
              title={s.title || ""}
              className="absolute rounded-sm"
              style={{ left: left*colW + 2, width: w*colW - 4, height: 8, top: rowHeight - 12, background: s.color || "#FBBF24", opacity: 0.85 }}
            />
          );
        })}
        {/* segments (multiple bars per row, e.g., team timeline) */}
        {(row.segments || []).map((s, i) => {
          const a = idxOf(s.start), b = idxOf(s.end);
          const left = Math.max(0, Math.min(totalCols-1, a));
          const w = Math.max(1, b - a + 1);
          return (
            <div key={`seg-${i}`}
              title={s.title || ""}
              onClick={(e)=>{ e.stopPropagation(); s.onClick && s.onClick(); }}
              className="absolute rounded-sm flex items-center px-1.5 overflow-hidden cursor-pointer hover:opacity-90"
              style={{ left: left*colW + 2, width: w*colW - 4, height: rowHeight - 20, top: 8, background: s.color || "#2563EB" }}
            >
              {w * colW > 60 && (
                <span className="text-white text-[11px] font-medium truncate">{s.title}</span>
              )}
            </div>
          );
        })}
        {/* main bar */}
        {hasMainBar && (
        <div
          className="absolute rounded-sm flex items-center select-none"
          style={{ left: lp * colW + 2, width: wd * colW - 4, top: 8, height: rowHeight - 20, background: color, cursor: editable ? "grab" : "pointer" }}
          onMouseDown={beginDrag("move")}
          data-testid={`gantt-bar-${row.id}`}
        >
          {editable && (
            <>
              <div
                onMouseDown={beginDrag("resize-left")}
                className="absolute left-0 top-0 bottom-0 w-2 rounded-l-sm hover:bg-white/30"
                style={{ cursor: "ew-resize" }}
                data-testid={`gantt-resize-left-${row.id}`}
              />
              <div
                onMouseDown={beginDrag("resize-right")}
                className="absolute right-0 top-0 bottom-0 w-2 rounded-r-sm hover:bg-white/30"
                style={{ cursor: "ew-resize" }}
                data-testid={`gantt-resize-right-${row.id}`}
              />
            </>
          )}
          {wd * colW > 60 && (
            <span className="text-white text-[11px] font-medium px-2 truncate w-full">{row.barLabel || row.label}</span>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
