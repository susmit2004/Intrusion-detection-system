"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Cpu,
  Database,
  GitCompare,
  GitMerge,
  House,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Research",
    items: [
      { label: "Home", href: "/home", icon: <House size={16} /> },
      { label: "Overview", href: "/overview", icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    label: "Experiments",
    items: [
      { label: "Suricata Testbed", href: "/primary-model", icon: <Shield size={16} /> },
      { label: "CIC-IDS-2017", href: "/secondary-model", icon: <Database size={16} /> },
      { label: "Cross-Experiment Ensemble", href: "/ensemble", icon: <GitMerge size={16} /> },
    ],
  },
  {
    label: "Evaluation",
    items: [
      { label: "Comparison", href: "/comparison", icon: <GitCompare size={16} /> },
      { label: "Feature Analysis", href: "/analysis", icon: <BarChart3 size={16} /> },
      { label: "Performance", href: "/performance", icon: <Activity size={16} /> },
      { label: "Prediction Results", href: "/results", icon: <Cpu size={16} /> },
      { label: "Configuration", href: "/configuration", icon: <Settings size={16} /> },
    ],
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function NavLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "border-[color-mix(in_srgb,var(--accent)_18%,transparent)] border-l-[3px] border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      <span className={active ? "text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"}>
        {item.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active && <ChevronRight size={13} aria-hidden="true" />}
    </Link>
  );
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 cursor-default bg-black/65 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        id="main-navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[236px] shrink-0 flex-col border-r transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex min-h-[76px] items-center justify-between border-b px-5" style={{ borderColor: "var(--border-subtle)" }}>
          <Link href="/home" className="flex items-center gap-3 rounded-md focus-visible:outline" onClick={onClose}>
            <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--accent)]">
              <ShieldCheck size={21} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">SOC Research</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">ML alert triage</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-hover)] lg:hidden"
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => <NavLink key={item.href} item={item} onClose={onClose} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t px-4 py-4" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <span className="size-1.5 rounded-full bg-[var(--accent)]" /> Research prototype
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-muted)]">Suricata Testbed · CIC-IDS-2017</p>
        </div>
      </aside>
    </>
  );
}
