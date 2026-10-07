import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Database,
  GitCompareArrows,
  GitMerge,
  Info,
  Shield,
} from "lucide-react";

const experiments = [
  {
    index: "01",
    name: "Suricata Testbed",
    description: "Network traffic captured in a controlled testbed environment using Suricata.",
    featureCount: "22",
    rowCount: "3,607",
    href: "/primary-model",
    icon: Shield,
    accent: "lime",
  },
  {
    index: "02",
    name: "CIC-IDS-2017",
    description: "A separate public network-flow dataset with benign traffic and attack scenarios.",
    featureCount: "12",
    rowCount: "30,000",
    href: "/secondary-model",
    icon: Database,
    accent: "teal",
  },
];

const researchLinks = [
  { href: "/overview", label: "Overview", icon: Activity },
  { href: "/ensemble", label: "Ensemble", icon: GitMerge },
  { href: "/comparison", label: "Comparison", icon: GitCompareArrows },
  { href: "/analysis", label: "Feature analysis", icon: BarChart3 },
];

function NetworkGlobe() {
  return (
    <svg
      viewBox="0 0 640 520"
      role="img"
      aria-label="Decorative network globe illustrating connected traffic flows"
      className="pointer-events-none absolute -right-24 -top-24 h-[440px] w-[540px] max-w-none opacity-75 sm:-right-10 sm:top-[-115px] sm:h-[560px] sm:w-[660px] lg:right-[-55px] lg:top-[-150px] lg:h-[650px] lg:w-[760px]"
    >
      <defs>
        <radialGradient id="globeSurface" cx="42%" cy="38%" r="68%">
          <stop offset="0%" stopColor="var(--globe-center)" stopOpacity="0.58" />
          <stop offset="72%" stopColor="var(--globe-mid)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--bg-base)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="globeLine" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="var(--accent)" stopOpacity="0.06" />
          <stop offset="48%" stopColor="var(--globe-teal)" stopOpacity="0.52" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
        </linearGradient>
        <clipPath id="globeClip"><circle cx="336" cy="256" r="211" /></clipPath>
        <pattern id="globeDots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.9" fill="var(--globe-teal)" fillOpacity="0.42" />
        </pattern>
      </defs>
      <circle cx="336" cy="256" r="219" fill="url(#globeSurface)" stroke="var(--globe-outline)" strokeOpacity="0.22" />
      <g clipPath="url(#globeClip)" fill="none" stroke="url(#globeLine)" strokeWidth="0.9">
        <ellipse cx="336" cy="256" rx="205" ry="62" />
        <ellipse cx="336" cy="256" rx="211" ry="124" />
        <ellipse cx="336" cy="256" rx="211" ry="181" />
        <ellipse cx="336" cy="256" rx="74" ry="211" />
        <ellipse cx="336" cy="256" rx="145" ry="211" />
        <path d="M120 175 C190 208 243 193 290 158 S388 113 430 157 490 191 553 162" />
        <path d="M112 308 C188 283 232 305 292 342 S405 377 454 332 504 289 563 306" />
        <path d="M158 88 C210 153 212 204 177 251 S151 345 193 408" />
        <path d="M484 92 C437 146 432 204 469 251 S498 354 454 418" />
        <path d="M170 246 L236 212 281 253 335 174 386 224 449 192 510 235" />
        <path d="M202 322 L264 284 318 330 371 282 416 328 475 286 531 309" />
      </g>
      <g clipPath="url(#globeClip)" fill="url(#globeDots)" opacity="0.64">
        <path d="M166 160l54-42 53 9 24 44-22 30-44-8-22 29-47-6-25-30z" />
        <path d="M247 240l48 12 20 38-8 53-30 60-26-13 2-47-24-34 3-38z" />
        <path d="M332 143l51-30 57 12 45 43-23 31-46-12-22 30-49-9-21-30-25 1z" />
        <path d="M405 239l52-20 51 31 27 43-35 32-48-9-35 22-30-29 17-39z" />
      </g>
      <g fill="var(--accent)">
        <circle cx="236" cy="212" r="3.3" /><circle cx="335" cy="174" r="4" />
        <circle cx="449" cy="192" r="3" /><circle cx="318" cy="330" r="3.5" />
        <circle cx="416" cy="328" r="2.7" /><circle cx="510" cy="235" r="3.4" />
      </g>
      <g fill="var(--globe-teal)">
        <circle cx="281" cy="253" r="2.5" /><circle cx="386" cy="224" r="2.8" />
        <circle cx="264" cy="284" r="2.6" /><circle cx="475" cy="286" r="2.5" />
      </g>
    </svg>
  );
}

function ExperimentCard({
  experiment,
}: {
  experiment: (typeof experiments)[number];
}) {
  const Icon = experiment.icon;
  const tint = experiment.accent === "lime" ? "var(--accent)" : "var(--risk-low)";

  return (
    <Link
      href={experiment.href}
      className="group relative overflow-hidden rounded-xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--bg-card-hover)] sm:p-6"
      style={{
        borderColor: "var(--border-subtle)",
        background: "linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 96%, white), var(--bg-card))",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex size-[68px] shrink-0 items-center justify-center rounded-xl border"
          style={{
            color: tint,
            borderColor: `color-mix(in srgb, ${tint} 20%, transparent)`,
            background: `color-mix(in srgb, ${tint} 10%, var(--bg-elevated))`,
          }}
        >
          <Icon size={28} strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] tracking-[0.15em] text-[var(--text-muted)]">EXPERIMENT {experiment.index}</span>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)] sm:text-xl">{experiment.name}</h2>
            </div>
            <ArrowUpRight size={17} className="mt-1 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--accent)]" />
          </div>
          <p className="mt-2 max-w-md text-[13px] leading-5 text-[var(--text-secondary)]">{experiment.description}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Input schema</p>
          <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: tint }}>{experiment.featureCount} features</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Test split</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">{experiment.rowCount} rows</p>
        </div>
      </div>
    </Link>
  );
}

const workflow = [
  { title: "Network Features", caption: "Dataset-specific flow data", icon: Database },
  { title: "Model Scores", caption: "Two separate model outputs", icon: GitMerge },
  { title: "Weighted Score", caption: "Experiment settings", icon: BarChart3 },
  { title: "Analyst Review", caption: "Decision support", icon: Shield },
];

export default function HomePage() {
  return (
    <DashboardLayout title="Home" subtitle="Project introduction">
      <main className="mx-auto max-w-[1500px]">
        <section className="relative isolate min-h-[370px] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-5 py-9 sm:min-h-[390px] sm:px-8 sm:py-11 lg:px-10">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(156,177,168,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(156,177,168,0.035)_1px,transparent_1px)] bg-[size:30px_30px]" />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_72%_43%,rgba(111,217,189,0.08),transparent_54%)]" />
          <NetworkGlobe />
          <div className="relative z-10 max-w-[700px]">
            <div className="mb-5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              <span className="h-[2px] w-8 bg-[var(--accent)]" /> Network intrusion research
            </div>
            <h1 className="max-w-[740px] text-[2.75rem] font-semibold leading-[0.99] tracking-[-0.045em] text-[var(--text-primary)] sm:text-6xl lg:text-[4.5rem]">
              A clearer view of <span className="text-[var(--accent)]">network alerts.</span>
            </h1>
            <p className="mt-5 max-w-[620px] text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base">
              A confidence-based hybrid machine learning framework for SOC alert triage, combining Logistic Regression and Random Forest to support review of network traffic.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
              <Link href="/overview" className="inline-flex items-center gap-2 font-semibold text-[var(--accent)] transition hover:text-[var(--text-primary)]">
                Explore the research <ArrowRight size={14} />
              </Link>
              <span>Scores are estimates for research review</span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-2" aria-label="Independent experiments">
          {experiments.map((experiment) => <ExperimentCard key={experiment.href} experiment={experiment} />)}
        </section>

        <section className="mt-5 rounded-xl border p-5 sm:p-6" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
          <div className="mb-5 flex items-center gap-3">
            <span className="h-[2px] w-8 bg-[var(--accent)]" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[var(--text-secondary)]">Framework overview</h2>
          </div>
          <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1.25fr_auto_1fr_auto_1fr]">
            {workflow.map(({ title, caption, icon: Icon }, index) => (
              <div key={title} className="contents">
                <div className="flex min-h-[128px] flex-col justify-between rounded-lg border p-4" style={{ borderColor: "var(--border-subtle)", background: "linear-gradient(145deg, var(--bg-elevated), color-mix(in srgb, var(--bg-card) 85%, black))" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">0{index + 1}</span>
                    <Icon size={19} className={index === 1 ? "text-[var(--risk-low)]" : "text-[var(--accent)]"} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{caption}</p>
                    {index === 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded border border-[var(--model-lr)]/20 bg-[var(--model-lr)]/[0.07] px-1.5 py-1 text-[10px] text-[var(--model-lr)]">Logistic Regression</span>
                        <span className="rounded border border-[var(--risk-low)]/20 bg-[color-mix(in_srgb,var(--risk-low)_7%,transparent)] px-1.5 py-1 text-[10px] text-[var(--risk-low)]">Random Forest</span>
                      </div>
                    )}
                  </div>
                </div>
                {index < workflow.length - 1 && <div className="hidden items-center justify-center text-[var(--text-muted)] lg:flex"><ArrowRight size={18} /></div>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
            The experiments are trained and evaluated separately. The cross-experiment ensemble is an exploratory feature with demonstration defaults.
          </p>
        </section>

        <footer className="mt-5 flex flex-col gap-3 border-t px-1 py-4 text-xs leading-5 text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="flex items-start gap-2"><Info size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" /><span>This is a research project. Model scores are estimates and should not be used alone for operational decisions.</span></p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {researchLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="inline-flex items-center gap-1.5 transition hover:text-[var(--accent)]"><Icon size={13} />{label}</Link>)}
          </div>
        </footer>
      </main>
    </DashboardLayout>
  );
}
