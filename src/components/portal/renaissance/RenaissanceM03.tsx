import { Funnel, RenaissanceStatCards, ObserverBadge, type FunnelStep } from "./Funnel";

interface Props {
  clearedForCbt: number;
  booked: number;
  centreNames: string[];
}

export function RenaissanceM03({ clearedForCbt, booked, centreNames }: Props) {
  const steps: FunnelStep[] = [
    { label: "M-02 clearances finalised", count: clearedForCbt, total: clearedForCbt || 1 },
    { label: "Candidate slots booked", count: booked, total: clearedForCbt || 1 },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            📅
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-03 · Book CBT</h1>
            <p className="text-sm text-[#646464]">Assessment Scheduling Observer — Renaissance</p>
          </div>
          <div className="ml-auto hidden sm:block">
            <ObserverBadge />
          </div>
        </div>

        <RenaissanceStatCards
          stats={[
            { label: "Cleared for CBT", value: clearedForCbt, color: "#058812" },
            { label: "Booked", value: booked, color: "#1B4F8A" },
            { label: "Exam Centres", value: centreNames.length, color: "#323232" },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">M-03 Scheduling Pipeline</h3>
            <p className="text-xs text-[#969696] mt-0.5">Read-only — managed by Radial Circle and CBT Officers</p>
          </div>
          <div className="p-6">
            {clearedForCbt === 0 ? <p className="text-sm text-[#969696]">No candidates cleared for CBT yet.</p> : <Funnel steps={steps} />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Renaissance Role in M-03</h3>
            <div className="p-4 rounded-xl" style={{ background: "#05881208", border: "1px solid #05881220" }}>
              <p className="text-sm text-[#646464] leading-relaxed">
                Renaissance holds an observation role in M-03. Scheduling and confirmation are managed by Radial Circle and
                CBT Officers. Renaissance will be notified when exam results are finalised in M-04.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Exam Centres</h3>
            {centreNames.length === 0 ? (
              <p className="text-xs text-[#969696]">No centres configured yet.</p>
            ) : (
              <div className="space-y-2.5">
                {centreNames.map((c) => (
                  <div key={c} className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-[#058812]" />
                    <span className="text-[12px] font-heading font-semibold text-[#323232]">{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
