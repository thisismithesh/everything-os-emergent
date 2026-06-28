import PageHeader from "@/components/layout/PageHeader";

export function PlaceholderPage({ eyebrow, title, description }) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="p-8">
        <div className="bg-white border border-dashed border-[var(--border-default)] rounded-md p-16 text-center">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-tertiary)] font-semibold">Coming soon</div>
          <h2 className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'Cabinet Grotesk'" }}>This module is in the backlog</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md mx-auto">
            We&apos;ve scaffolded this page in the menu so navigation and access control feel real.
            Specs and data points will land here next.
          </p>
        </div>
      </div>
    </>
  );
}

export function Marketing()  { return <PlaceholderPage eyebrow="Marketing"  title="Marketing"  description="Campaigns, leads, brand activity." />; }
export function Sales()      { return <PlaceholderPage eyebrow="Sales"      title="Sales"      description="Pipeline, proposals, conversions." />; }
export function Company()    { return <PlaceholderPage eyebrow="Company"    title="Company"    description="Policies, handbook, internal updates." />; }
