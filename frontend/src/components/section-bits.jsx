// Shared tiny helpers for the new section pages (Marketing / Sales / Company).
import { useState } from "react";

export function TabBar({ tabs, active, onChange }) {
  return (
    <div className="border-b border-[var(--border-default)] flex items-center gap-1 px-8" data-testid="tabbar">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            data-testid={`tab-${t.key}`}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pill({ children, color = "#0A0A0A", onRemove, testid }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-sm"
      style={{ background: `${color}10`, color, border: `1px solid ${color}30` }}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
      )}
    </span>
  );
}

export function TagInput({ value, onChange, placeholder = "Add tag…", testid = "tag-input" }) {
  const [text, setText] = useState("");
  const commit = () => {
    const v = text.trim().toLowerCase().replace(/^#/, "");
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-[var(--border-default)] rounded-md px-2 py-1.5 bg-white" data-testid={testid}>
      {value.map((t) => (
        <Pill key={t} onRemove={() => onChange(value.filter((x) => x !== t))} testid={`tag-pill-${t}`}>{t}</Pill>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && text === "" && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent py-0.5"
      />
    </div>
  );
}

export function ModalShell({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose} data-testid="modal-shell">
      <div className="bg-white border border-[var(--border-default)] rounded-md shadow-xl w-full" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
          <div className="text-base font-bold tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>{title}</div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-2xl leading-none" data-testid="modal-close-btn">×</button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function fmtINR(n) {
  if (!n || n === 0) return "—";
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
}
