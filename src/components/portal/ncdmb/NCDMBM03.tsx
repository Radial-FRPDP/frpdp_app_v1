export interface ZoneBookingRow {
  zone: string;
  cleared: number;
  booked: number;
}

export interface CentreSummaryRow {
  name: string;
  slots: number;
  candidatesSeated: number;
}

interface Props {
  eligibleCount: number;
  bookingsConfirmed: number;
  centres: CentreSummaryRow[];
  zones: ZoneBookingRow[];
  nextSession: string | null;
  lastSession: string | null;
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function NCDMBM03({ eligibleCount, bookingsConfirmed, centres, zones, nextSession, lastSession }: Props) {
  const notYetBooked = Math.max(0, eligibleCount - bookingsConfirmed);
  const bookingRate = pct(bookingsConfirmed, eligibleCount);

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#1B4F8A15" }}>
            📅
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-03 · Book CBT</h1>
            <p className="text-sm text-[#646464]">Assessment Scheduling Oversight — NCDMB</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <span className="text-[11px] font-heading font-bold px-3 py-1.5 rounded-full" style={{ background: "#1B4F8A15", color: "#1B4F8A", border: "1px solid #1B4F8A25" }}>
              Read-only Oversight
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Eligible (Cleared M-02)", value: eligibleCount, color: "#058812" },
            { label: "Bookings Confirmed", value: bookingsConfirmed, color: "#1B4F8A" },
            { label: "Not Yet Booked", value: notYetBooked, color: "#e05c00" },
            { label: "Booking Rate", value: `${bookingRate}%`, color: "#058812" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-elev-2">
              <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#969696] mb-1">{s.label}</div>
              <div className="font-heading font-extrabold text-2xl" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">Booking Progress by Zone</h3>
            <p className="text-xs text-[#969696] mt-0.5">Out of candidates cleared at M-02</p>
          </div>
          <div className="p-6 space-y-5">
            {zones.length === 0 && <p className="text-sm text-[#969696]">No cleared candidates with a zone recorded yet.</p>}
            {zones.map((z) => {
              const zPct = pct(z.booked, z.cleared);
              return (
                <div key={z.zone}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-heading font-semibold text-sm text-[#323232]">{z.zone}</span>
                    <span className="text-[11px] text-[#969696]">
                      {z.booked} / {z.cleared} booked
                    </span>
                  </div>
                  <div className="w-full rounded-full h-3 overflow-hidden" style={{ background: "#f4f4f4" }}>
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${zPct}%`, background: zPct >= 80 ? "#058812" : zPct >= 65 ? "#1B4F8A" : "#FBBD15" }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-heading font-bold mt-1 inline-block"
                    style={{ color: zPct >= 80 ? "#058812" : zPct >= 65 ? "#1B4F8A" : "#846205" }}
                  >
                    {zPct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">Exam Centres</h3>
          </div>
          <div className="divide-y" style={{ borderColor: "#f4f4f4" }}>
            {centres.length === 0 && <p className="px-5 py-4 text-xs text-[#969696]">No centres configured yet.</p>}
            {centres.map((c) => (
              <div key={c.name} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-heading font-semibold text-[#323232]">{c.name}</p>
                  <p className="text-[10px] text-[#969696]">{c.slots} slot{c.slots === 1 ? "" : "s"}</p>
                </div>
                <div className="font-heading font-bold text-sm" style={{ color: c.candidatesSeated > 0 ? "#1B4F8A" : "#D8D8D8" }}>
                  {c.candidatesSeated > 0 ? `${c.candidatesSeated} booked` : "—"}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Schedule Milestones</h3>
            {!nextSession ? (
              <p className="text-xs text-[#969696]">No CBT sessions scheduled yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#1B4F8A" }} />
                  <div>
                    <p className="text-[12px] font-heading font-semibold text-[#323232]">Next CBT session</p>
                    <p className="text-[10px] text-[#969696]">{formatDate(nextSession)}</p>
                  </div>
                </div>
                {lastSession && lastSession !== nextSession && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#D8D8D8" }} />
                    <div>
                      <p className="text-[12px] font-heading font-semibold text-[#323232]">Last scheduled session</p>
                      <p className="text-[10px] text-[#969696]">{formatDate(lastSession)}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
