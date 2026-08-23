import Link from "next/link";

const AUDIENCES = [
  { label: "Radial Circle", desc: "Programme Manager", icon: "🧭" },
  { label: "NCDMB", desc: "Programme Oversight", icon: "🛡️" },
  { label: "Renaissance", desc: "Industry Partner", icon: "🤝" },
  { label: "CBT Officer", desc: "Assessment Centre", icon: "🖥️" },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col" style={{ background: "#f4f4f4" }}>
      <header className="w-full px-6 lg:px-10 py-5 flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand-lockup.png" alt="Field Readiness Programme" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl text-sm font-heading font-bold transition-colors"
            style={{ color: "#323232" }}
          >
            Sign In
          </Link>
          <Link
            href="/request-access"
            className="px-4 py-2 rounded-xl text-sm font-heading font-bold text-white transition-all"
            style={{ background: "#058812" }}
          >
            Request Access
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center px-6 lg:px-10 py-12">
        <div className="max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider mb-6"
              style={{ background: "#05881212", color: "#058812", border: "1px solid #05881230" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#058812]" />
              2025 Cohort — In Progress
            </span>
            <h1 className="font-heading font-extrabold text-4xl lg:text-5xl text-[#323232] leading-tight mb-5">
              Field Readiness Programme
            </h1>
            <p className="text-[#646464] text-lg leading-relaxed mb-8 max-w-lg">
              The shared platform for nomination, verification, assessment, and onboarding across NCDMB&apos;s local-content
              field readiness cohort — from intake through deployment.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                href="/login"
                className="px-7 py-3.5 rounded-xl text-white text-sm font-heading font-bold flex items-center gap-2 transition-all"
                style={{ background: "#058812" }}
              >
                Sign In
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/request-access"
                className="px-7 py-3.5 rounded-xl text-sm font-heading font-bold border-2 transition-all"
                style={{ borderColor: "#D8D8D8", color: "#323232" }}
              >
                Request Staff Access
              </Link>
            </div>

            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#FBBD1512", border: "1px solid #FBBD1530" }}>
              <span className="text-lg shrink-0">📩</span>
              <p className="text-[13px] text-[#646464] leading-relaxed">
                <strong className="text-[#323232]">Nominated candidate?</strong> You don&apos;t need to sign up here — use
                the secure link from your nomination email, or{" "}
                <Link href="/login" className="font-semibold" style={{ color: "#058812" }}>
                  sign in with your JQS Number
                </Link>{" "}
                if you&apos;ve already set a password.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-elev-3 p-7">
            <h2 className="font-heading font-bold text-sm text-[#323232] mb-1">Who&apos;s this platform for</h2>
            <p className="text-[12px] text-[#969696] mb-5">Every organisation in the programme signs in from the same place.</p>
            <div className="grid grid-cols-2 gap-3">
              {AUDIENCES.map((a) => (
                <div key={a.label} className="rounded-xl p-4" style={{ background: "#f4f4f4" }}>
                  <span className="text-xl">{a.icon}</span>
                  <div className="font-heading font-bold text-sm text-[#323232] mt-2">{a.label}</div>
                  <div className="text-[11px] text-[#969696] mt-0.5">{a.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5" style={{ borderTop: "1px solid #f4f4f4" }}>
              <p className="text-[12px] text-[#646464] leading-relaxed">
                New to the programme staff team? <strong className="text-[#323232]">Request Access</strong> and a Programme
                Manager will set up your account and org role.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 lg:px-10 py-5 text-center text-[11px] text-[#969696]">
        Field Readiness Programme — a joint platform for NCDMB, Renaissance Africa Energy, and accredited assessment centres.
      </footer>
    </main>
  );
}
