interface ComingSoonProps {
  moduleCode: string;
  moduleTitle: string;
}

export function ComingSoon({ moduleCode, moduleTitle }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl" style={{ background: "#f4f4f4" }}>
          🔒
        </div>
        <h2 className="font-heading font-extrabold text-xl text-[#323232] mb-2">
          {moduleCode} — {moduleTitle}
        </h2>
        <p className="text-[#646464] text-sm leading-relaxed mb-6">
          This module isn&apos;t live in production yet. It&apos;s being built out next — this isn&apos;t a demo placeholder, the
          real screen is still under construction.
        </p>
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-heading font-bold"
          style={{ background: "#05881212", color: "#058812", border: "1px solid #05881230" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#058812]" />
          Coming Soon
        </div>
      </div>
    </div>
  );
}
