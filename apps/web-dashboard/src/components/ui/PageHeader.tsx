interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: "lime" | "teal" | "amber" | "coral" | "blue" | "violet" | "emerald";
  children?: React.ReactNode;
}

const BADGE_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  lime:    { bg: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" },
  teal:    { bg: "color-mix(in srgb, var(--color-normal) 10%, transparent)", border: "color-mix(in srgb, var(--color-normal) 25%, transparent)", color: "var(--color-normal)" },
  amber:   { bg: "color-mix(in srgb, var(--color-review) 10%, transparent)", border: "color-mix(in srgb, var(--color-review) 25%, transparent)", color: "var(--color-review)" },
  coral:   { bg: "color-mix(in srgb, var(--color-attack) 10%, transparent)", border: "color-mix(in srgb, var(--color-attack) 25%, transparent)", color: "var(--color-attack)" },
  // legacy aliases
  blue:    { bg: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)" },
  violet:  { bg: "color-mix(in srgb, var(--color-normal) 10%, transparent)", border: "color-mix(in srgb, var(--color-normal) 25%, transparent)", color: "var(--color-normal)" },
  emerald: { bg: "color-mix(in srgb, var(--color-normal) 10%, transparent)", border: "color-mix(in srgb, var(--color-normal) 25%, transparent)", color: "var(--color-normal)" },
};

export default function PageHeader({
  title,
  subtitle,
  badge,
  badgeColor = "lime",
  children,
}: PageHeaderProps) {
  const bs = BADGE_STYLES[badgeColor] ?? BADGE_STYLES.lime;

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          {badge && (
            <span
              className="self-start text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border"
              style={{ background: bs.bg, borderColor: bs.border, color: bs.color }}
            >
              {badge}
            </span>
          )}
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {children && <div className="flex items-center gap-2 mt-1">{children}</div>}
      </div>
      <div className="mt-4 h-px" style={{ background: "var(--border)" }} />
    </div>
  );
}
