import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Instrument_Serif } from "next/font/google";
import { Highlight } from "@/components/ui/highlight";

// Temporary owner-review page: compare headline faces in the real hero context.
// Delete after the font decision.
export const metadata: Metadata = { title: "Type preview", robots: { index: false } };

const instrument = Instrument_Serif({ subsets: ["latin"], weight: "400" });
const fraunces = Fraunces({ subsets: ["latin"], axes: ["SOFT", "opsz"], weight: "variable" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], weight: "variable" });

const options = [
  {
    key: "A",
    name: "Instrument Serif (current)",
    note: "Elegant, editorial, very trendy. Condensed letters get thin on small phones.",
    className: instrument.className,
    style: { fontWeight: 400, letterSpacing: "-0.01em" },
  },
  {
    key: "B",
    name: "Fraunces Soft (recommended)",
    note: "A warm serif with soft, rounded corners. Feels premium and trustworthy but friendly. Stays readable at phone sizes.",
    className: fraunces.className,
    style: { fontWeight: 500, letterSpacing: "-0.025em", fontVariationSettings: '"SOFT" 100, "opsz" 96' },
  },
  {
    key: "C",
    name: "Bricolage Grotesque",
    note: "A characterful modern sans. Youthful, startup energy, less 'serious certificate'.",
    className: bricolage.className,
    style: { fontWeight: 600, letterSpacing: "-0.035em" },
  },
];

export default function TypePreview() {
  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,var(--sky-1),var(--sky-2)_45%,var(--cream))] px-4 py-16 sm:px-8">
      <div className="mx-auto grid max-w-[1200px] gap-6 lg:grid-cols-3">
        {options.map((o) => (
          <section key={o.key} className="rounded-frame bg-white/45 p-6 ring-1 ring-white/70 sm:p-8">
            <p className="font-mono text-[12px] text-sky-ink">
              Option {o.key} · {o.name}
            </p>
            <h2 className={`${o.className} mt-5 text-[44px] leading-[1.05] text-ink sm:text-[52px]`} style={o.style}>
              Earn an internship your college can <Highlight>trust</Highlight>
            </h2>
            <h3 className={`${o.className} mt-8 text-[30px] leading-[1.1] text-ink`} style={o.style}>
              From enrolment to a certificate you <Highlight delay={900}>earned</Highlight>
            </h3>
            <p className="mt-5 text-[15.5px] leading-relaxed text-sky-ink">
              Body text stays Geist in every option. Learn step by step, build a project a mentor reviews, and get a
              certificate anyone can verify.
            </p>
            <p className="mt-6 border-t border-line pt-4 text-[14px] leading-relaxed text-ink-soft">{o.note}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
