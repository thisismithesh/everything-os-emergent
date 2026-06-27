// Reusable page header (breadcrumb + title + actions).
export default function PageHeader({ eyebrow, title, description, children }) {
  return (
    <header className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-[var(--border-default)]">
      <div className="px-8 py-5 flex items-end justify-between gap-6">
        <div>
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold mb-1">
              {eyebrow}
            </div>
          )}
          <h1
            className="text-2xl md:text-3xl font-black tracking-tight"
            style={{ fontFamily: "'Cabinet Grotesk'" }}
            data-testid="page-title"
          >
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
