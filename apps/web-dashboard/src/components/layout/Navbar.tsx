"use client";

import { Menu, Info } from "lucide-react";
import { isMockMode } from "@/services/apiService";
import ThemeToggle from "@/components/layout/ThemeToggle";

interface NavbarProps {
  onMenuClick: () => void;
  title: string;
  subtitle?: string;
}

export default function Navbar({ onMenuClick, title, subtitle }: NavbarProps) {
  return (
    <header
      aria-label={`${title} page header`}
      aria-description={subtitle}
      className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-4 border-b px-4 backdrop-blur-md sm:px-6 lg:px-8"
      style={{
        borderColor: "var(--border-subtle)",
        background: "color-mix(in srgb, var(--bg-base) 93%, transparent)",
      }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-hover)] lg:hidden"
          aria-label="Open navigation"
          aria-controls="main-navigation"
        >
          <Menu size={19} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-[var(--text-primary)] sm:text-lg">
            <span className="text-[var(--accent)]">SOC</span> Research Dashboard
          </p>
          <p className="hidden truncate text-xs text-[var(--text-secondary)] sm:block">
            Confidence-Based Hybrid ML Framework for SOC Alert Triage
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_25%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-primary)] sm:px-3 sm:text-xs">
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
          <span className="hidden sm:inline">Research Prototype</span>
          <span className="sm:hidden">Prototype</span>
        </span>
        {isMockMode && (
          <span className="hidden items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--risk-moderate)_25%,var(--border))] bg-[color-mix(in_srgb,var(--risk-moderate)_7%,transparent)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--risk-moderate)] md:inline-flex">
            <Info size={12} /> Demo data
          </span>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
