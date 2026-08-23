import { Funnel, RenaissanceStatCards, ObserverBadge, type FunnelStep } from "./Funnel";

export interface DisciplinePassRow {
  discipline: string;
  sat: number;
  passed: number;
}

interface Props {
  clearedAtM02: number;
  bookedAtM03: number;
  satExam: number;
  passed: number;
  disciplines: DisciplinePassRow[];
}

export function RenaissanceM04({ clearedAtM02, bookedAtM03, satExam, passed, disciplines }: Props) {
  const failed = satExam - passed;
  const passRate = satExam > 0 ? Math.round((passed / satExam) * 100) : 0;

  const steps: FunnelStep[] = [
    { label: "Candidates cleared at M-02", count: clearedAtM02, total: clearedAtM02 || 1 },
    { label: "Booked CBT slots (M-03)", count: bookedAtM03, total: clearedAtM02 || 1 },
    { label: "Sat CBT exam", count: satExam, total: bookedAtM03 || 1 },
    { label: "Passed exam (≥50%)", count: passed, total: satExam || 1 },
    { label: "Selected for programme (M-05)", count: 0, total: passed || 1, detail: "M-05 not built yet" },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: "#05881215" }}>
            🖥
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-2xl text-[#323232]">M-04 · Assess</h1>
            <p className="text-sm text-[#646464]">CBT Results Observer — Renaissance</p>
          </div>
          <span className="ml-auto hidden sm:block">
            <ObserverBadge />
          </span>
        </div>

        <RenaissanceStatCards
          stats={[
            { label: "Sat Exam", value: satExam, color: "#1B4F8A" },
            { label: "Passed", value: passed, color: "#058812" },
            { label: "Failed", value: Math.max(0, failed), color: "#e05c00" },
            { label: "Pass Rate", value: `${passRate}%`, color: "#058812" },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-elev-2 overflow-hidden">
          <div className="px-6 py-5 border-b" style={{ borderColor: "#f4f4f4" }}>
            <h3 className="font-heading font-bold text-sm text-[#323232]">Programme Funnel — Stages 1–5</h3>
            <p className="text-xs text-[#969696] mt-0.5">Candidate progression from nomination to programme selection</p>
          </div>
          <div className="p-6">
            {clearedAtM02 === 0 ? <p className="text-sm text-[#969696]">No candidates have reached M-02 clearance yet.</p> : <Funnel steps={steps} />}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-3">Renaissance Interest</h3>
            <div className="p-4 rounded-xl" style={{ background: "#05881208", border: "1px solid #05881220" }}>
              <p className="text-[12px] text-[#646464] leading-relaxed">
                Renaissance will review M-05 selection shortlists and confirm available mentorship and OJT placements for
                successful candidates. Results data here is for pipeline planning only.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-2 p-5">
            <h3 className="font-heading font-bold text-sm text-[#323232] mb-4">Pass Rate by Discipline</h3>
            {disciplines.filter((d) => d.sat > 0).length === 0 ? (
              <p className="text-xs text-[#969696]">No results recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {disciplines
                  .filter((d) => d.sat > 0)
                  .map((d) => {
                    const rate = Math.round((d.passed / d.sat) * 100);
                    return (
                      <div key={d.discipline}>
                        <div className="flex justify-between mb-1">
                          <span className="text-[11px] font-heading font-semibold text-[#323232]">{d.discipline}</span>
                          <span className="text-[11px] font-heading font-bold" style={{ color: rate >= 70 ? "#058812" : "#1B4F8A" }}>
                            {rate}%
                          </span>
                        </div>
                        <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "#f4f4f4" }}>
                          <div className="h-2 rounded-full" style={{ width: `${rate}%`, background: rate >= 70 ? "#058812" : "#1B4F8A" }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
