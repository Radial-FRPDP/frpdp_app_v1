export interface FunnelStep {
  label: string;
  count: number;
  total: number;
  detail?: string;
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * The reference's connected numbered-step funnel visual, used across all
 * four Renaissance observer screens (M-01 to M-04) — Renaissance's design
 * language is deliberately distinct from NCDMB's zone/table breakdown,
 * matching the Figma reference's own choice to give the pure-observer
 * role a pipeline/funnel framing rather than an operational dashboard.
 * A step counts as "done" once it's at 100%.
 */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="space-y-5">
      {steps.map((s, i) => {
        const p = pct(s.count, s.total);
        const done = s.total > 0 && p >= 100;
        return (
          <div key={s.label} className="flex items-start gap-4">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-heading font-bold"
                style={{
                  background: done ? "#058812" : p > 0 ? "#1B4F8A" : "#f4f4f4",
                  color: done || p > 0 ? "white" : "#969696",
                }}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < steps.length - 1 && <div className="w-0.5 h-8 mt-1" style={{ background: done ? "#05881240" : "#D8D8D8" }} />}
            </div>
            <div className="flex-1 pt-0.5 pb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-heading font-semibold text-sm text-[#323232]">{s.label}</span>
                <span className="text-[11px] font-heading font-bold" style={{ color: done ? "#058812" : p > 0 ? "#1B4F8A" : "#D8D8D8" }}>
                  {s.total > 0 ? `${p}%` : "—"}
                </span>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden mb-1" style={{ background: "#f4f4f4" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${p}%`, background: done ? "#058812" : "#1B4F8A" }} />
              </div>
              <div className="text-[11px] text-[#969696]">
                {s.detail ?? `${s.count.toLocaleString()} of ${s.total.toLocaleString()}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RenaissanceStatCards({ stats }: { stats: { label: string; value: string | number; color: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-white rounded-2xl p-4 shadow-elev-2">
          <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
          <div className="font-heading font-extrabold text-2xl" style={{ color: s.color }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ObserverBadge() {
  return (
    <span
      className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full hidden sm:inline-flex items-center gap-1.5"
      style={{ background: "#05881210", color: "#058812", border: "1px solid #05881225" }}
    >
      👁 Observation Mode
    </span>
  );
}
