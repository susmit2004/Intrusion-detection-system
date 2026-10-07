# Implementation Plan — IDS Dashboard Frontend Redesign

> **Frozen files (never touch):** `src/services/apiService.ts` (logic), `src/lib/mockData.ts` (values), `src/lib/constants.ts`, `src/types/index.ts`, any Python files under `d:\Intrusion-detection-system\ML Models\`.
>
> **Build command:** `cd d:\Intrusion-detection-system\ids-dashboard && npm run build`
> A clean build (exit 0, no TS/ESLint errors) is the pass criterion for every item.

---

## FEAT-001 — Design-Token Foundation

- [ ] 1. **Update CSS custom properties in `src/app/globals.css`**
      Expand the `:root` block with a richer, more systematic palette. Keep all existing variable names (never remove any). Add new tokens:
      - Background: `--bg-base:#010D1A`, `--bg-card:#071525`, `--bg-card-hover:#0C1E35`, `--bg-panel:#0E1C2F`, `--surface-raised:#0C1E35`, `--surface-inset:#040E1A`
      - Borders: `--border:#1A3352`, `--border-subtle:#0F2037` (keep `--border-color:#1E3A5F` for Recharts tooltip compat)
      - Text: `--text-primary:#F0F4F8`, `--text-secondary:#8FA3B8`, `--text-muted:#3D5475`
      - Glows: `--glow-blue:rgba(59,130,246,0.15)`, `--glow-violet:rgba(139,92,246,0.15)`
      - Transition: `--transition-base:150ms ease`
      - Keep all accent and risk tokens (`--accent`, `--risk-high`, `--color-attack`, etc.) unchanged.
      Add utility classes: `.card-border`, `.surface-inset`. Update scrollbar thumb to `#1A3352`. Update `.glass` alpha values.
      Add `@keyframes shimmer` for future skeleton loaders (no existing animation broken).
      Files: `src/app/globals.css`
      Verify: `npm run build`

- [ ] 2. **Update `CHART_COLORS` in `src/lib/utils.ts`**
      Replace only the `CHART_COLORS` const — no other changes to this file.
      New values: `attack:'#F87171'`, `normal:'#34D399'`, `high:'#F87171'`, `moderate:'#FBBF24'`, `low:'#34D399'`, `lr:'#38BDF8'`, `rf:'#FB923C'`, `hybrid:'#A78BFA'`, `primary:'#60A5FA'`, `secondary:'#A78BFA'`, `grid:'#1A3352'`, `text:'#8FA3B8'`.
      Add two new entries: `gridLight:'#0F2037'` and `muted:'#3D5475'`.
      **Do NOT change** any function, import, or export in this file.
      Files: `src/lib/utils.ts`
      Verify: `npm run build`

---

## FEAT-002 — Layout & Shared UI Components

*Depends on FEAT-001 tokens being in place.*

- [ ] 3. **Polish `src/components/layout/Sidebar.tsx`**
      Token + text updates only — no structural JSX changes:
      - Sidebar logo subtext: `'SOC Analytics v1.0'` → `'Hybrid ML · SOC Alert Triage'`
      - Footer card: update gradient classes to `from-blue-500/8 via-violet-500/5 to-transparent`; footer text: `'CIC-IDS-2017'` → `'IDS Dashboard · MCA Research'`; subtitle → `'Hybrid ML Framework · 2025'`
      - Nav link transitions: add `transition-[var(--transition-base)]` style on each Link
      Files: `src/components/layout/Sidebar.tsx`
      Verify: `npm run build`

- [ ] 4. **Polish `src/components/layout/Navbar.tsx`**
      - Background: `color-mix(in srgb, var(--bg-base) 85%, transparent)` (was 80%)
      - Add a thin left accent bar `<span>` before page title h1 when title is truthy
      - 'Live' status dot: add `pulse-live` CSS class (already defined in globals.css)
      Files: `src/components/layout/Navbar.tsx`
      Verify: `npm run build`

- [ ] 5. **Polish `src/components/ui/StatCard.tsx`**
      - Hover border: `hover:border-[var(--accent-blue)]/40` (was `hover:border-[#2d5286]`)
      - Subtitle: `text-[11px]` → `text-xs`
      - Add a mirrored subtle bottom gradient line (same accent color at 20% opacity, `h-px`)
      - Icon container: add `shadow-sm`
      Files: `src/components/ui/StatCard.tsx`
      Verify: `npm run build`

- [ ] 6. **Polish `src/components/ui/ChartCard.tsx`**
      - Hover border: `hover:border-[var(--accent-blue)]/40`
      - Header: add `bg-gradient-to-b from-[var(--bg-card-hover)]/30 to-transparent` to the header div
      Files: `src/components/ui/ChartCard.tsx`
      Verify: `npm run build`

- [ ] 7. **Enhance `src/components/ui/PageHeader.tsx`**
      - Title: change `text-xl` → `text-2xl`, color via `style={{color:'var(--text-primary)'}}`
      - Subtitle: change `text-sm text-slate-400` → `text-[13px] leading-relaxed`, color via CSS var
      - Add animated dot inside badge for `'blue'` and `'emerald'` variants
      - Add a `<div>` divider (`h-px`, color `var(--border)`) below the header block when badge prop is set
      Files: `src/components/ui/PageHeader.tsx`
      Verify: `npm run build`

- [ ] 8. **Token cleanup in `src/components/ui/DataTable.tsx`**
      Three targeted changes — **preserve all other logic exactly**:
      - Search input: `bg-[#0a1628] border-[#1e3a5f]` → `bg-[var(--bg-card)] border-[var(--border)]`; focus ring: `focus:border-[var(--accent-blue)]/60`
      - Striped rows: `bg-[#0a1628]`/`bg-[#0c1a30]` → `bg-[var(--bg-card)]`/`bg-[var(--bg-card-hover)]`
      - Table header: `bg-[#0f1f3d]` → `bg-[var(--surface-raised)]`
      - Pagination active button: `bg-blue-500/20 text-blue-400 border-blue-500/30` → `bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border-[var(--accent-blue)]/30`
      **MUST KEEP:** `id?: string` on `Column` interface; `key={(col.id ?? col.key) as string}` in both `<th>` and `<td>` renders.
      Files: `src/components/ui/DataTable.tsx`
      Verify: `npm run build`

---

## FEAT-003 — ML Components, Charts, and Page Content

*Depends on FEAT-001 and FEAT-002.*

- [ ] 9. **Fix `src/components/charts/ProbabilityHistogram.tsx` — axis labels**
      This is the "probability histogram label addition" requirement.
      - Add XAxis label: `label={{ value: 'Hybrid Score (calibrated)', fill: CHART_COLORS.text, fontSize: 10, position: 'insideBottom', offset: -5 }}`
      - Increase BarChart bottom margin: `bottom: 0` → `bottom: 20`
      - Add YAxis label: `label={{ value: 'Row Count', fill: CHART_COLORS.text, fontSize: 10, angle: -90, position: 'insideLeft', offset: 10 }}`
      - Adjust ReferenceLine label position to `'insideTopRight'` to avoid bar overlap
      - No changes to data generation or threshold logic
      Files: `src/components/charts/ProbabilityHistogram.tsx`
      Verify: `npm run build`

- [ ] 10. **Token cleanup in `src/components/ml/ConfusionMatrix.tsx`**
       - Container: `border-[#1e3a5f] bg-[#0a1628]` → `border-[var(--border)] bg-[var(--bg-card)]`
       - Summary bar: `border-[#1e3a5f]` → `border-[var(--border)]`
       - FP/FN cells: increase opacity to `/80` for readability (`text-red-400/80`, `text-amber-400/80`)
       - Header typography: add `font-bold tracking-widest` and use `style={{color:'var(--text-secondary)'}}`
       Files: `src/components/ml/ConfusionMatrix.tsx`
       Verify: `npm run build`

- [ ] 11. **Polish `src/components/ml/FeatureImportance.tsx`**
       - Container: replace hardcoded border/bg with `var(--border)`/`var(--bg-card)`
       - Feature name width: `w-48` → `w-44`
       - Bar track: `bg-[#1e3a5f]` → `bg-[var(--border)]`
       - Add `title={item.feature}` on each feature name `<span>` for accessibility
       - Footer note: `border-[#1e3a5f]` → `border-[var(--border)]`
       Files: `src/components/ml/FeatureImportance.tsx`
       Verify: `npm run build`

- [ ] 12. **Token cleanup in `src/components/ml/PredictionCard.tsx`**, `src/components/ml/ModelCard.tsx`, `src/components/ml/FileUpload.tsx`
       All three: replace `border-[#1e3a5f]`/`bg-[#0a1628]` with `var(--border)`/`var(--bg-card)`. No logic changes.
       Files: `src/components/ml/PredictionCard.tsx`, `src/components/ml/ModelCard.tsx`, `src/components/ml/FileUpload.tsx`
       Verify: `npm run build`

- [ ] 13. **Enrich `src/app/home/page.tsx`**
       Specific targeted additions (no structural rewrites):
       a) Badge text: `'MCA Research Project'` → `'SOC Alert Triage · Hybrid ML Research'`
       b) Add new section "Key Results at a Glance" between Triage Levels and Explore sections — 4 metric highlight chips in a 2×2 grid using existing component patterns (bg-panel, border-color).
       c) Tech stack: add `'FastAPI'` and `'Isotonic Calibration'` to the badge list
       d) NavButton primary style: replace `--accent` with `linear-gradient(135deg,#3B82F6,#8B5CF6)` background, white text, transparent border
       Files: `src/app/home/page.tsx`
       Verify: `npm run build`

- [ ] 14. **Update page subtitles and token cleanup — all dashboard pages**
       Apply to each page file listed below. For each: (1) update `DashboardLayout` `subtitle` prop, (2) update `PageHeader` `subtitle` prop, (3) replace hardcoded `bg-[#0a1628]`/`bg-[#0f1f3d]`/`border-[#1e3a5f]` with `var(--bg-card)`/`var(--surface-raised)`/`var(--border)`.
       **Do NOT change** chart tooltip `contentStyle` hex values (Recharts needs them as literals).

       | File | DashboardLayout subtitle | PageHeader subtitle |
       |---|---|---|
       | `src/app/overview/page.tsx` | `'Real-time SOC metrics across both experiments'` | `'Confidence-Based Hybrid ML Framework · Dual-dataset evaluation results'` |
       | `src/app/primary-model/page.tsx` | `'Suricata IDS Testbed · 22 engineered network-flow features'` | `'LR + RF hybrid on 22 Suricata features · w_LR=0.30 · w_RF=0.70 · threshold=0.5025'` |
       | `src/app/secondary-model/page.tsx` | `'CIC-IDS-2017 · 12 raw network-flow features · RF-dominant hybrid'` | `'RF-dominant hybrid (w_RF=1.0) · 30,000 test rows · 99.86% accuracy'` |
       | `src/app/ensemble/page.tsx` | `'Cross-dataset ensemble · 34-feature unified schema · configurable weights'` | *(keep existing — already detailed)* |
       | `src/app/comparison/page.tsx` | `'Primary (Suricata) vs Secondary (CIC-IDS-2017) — independent test sets'` | `'Fair comparison on independent held-out test sets — no cross-contamination'` |
       | `src/app/analysis/page.tsx` | `'Feature discrimination power across CIC-IDS-2017 network-flow features'` | *(keep existing — already detailed)* |
       | `src/app/performance/page.tsx` | `'Comprehensive test-set evaluation — all 6 models × 2 datasets'` | `'All metrics on held-out test data · Primary (3,607 rows) · Secondary (30,000 rows)'` |
       | `src/app/results/page.tsx` | `'Row-level hybrid scores, risk classification, and triage levels'` | `'LR + RF calibrated probabilities → Hybrid Score → Attack/Normal decision → SOC triage level'` |
       | `src/app/configuration/page.tsx` | `'All experiment parameters confirmed from training artifacts — read-only'` | *(keep existing — already detailed)* |

       **CRITICAL for `analysis/page.tsx`:** The `STATS_COLUMNS` array has two columns with `key: 'attack_median'`. The second one uses `id: 'attack_normal_ratio'` as the React key override. **Do not touch `STATS_COLUMNS` at all.** Only change the `DashboardLayout` subtitle and the hardcoded hex colors outside of the chart.

       Files: `src/app/overview/page.tsx`, `src/app/primary-model/page.tsx`, `src/app/secondary-model/page.tsx`, `src/app/ensemble/page.tsx`, `src/app/comparison/page.tsx`, `src/app/analysis/page.tsx`, `src/app/performance/page.tsx`, `src/app/results/page.tsx`, `src/app/configuration/page.tsx`
       Verify: `npm run build`

---

## What Must NOT Change

1. **`src/services/apiService.ts`** — any logic, mock mode flag, endpoint paths, or function signatures
2. **`src/lib/mockData.ts`** — any numeric values, array contents, or exports
3. **`src/lib/constants.ts`** — any constants, configs, or feature column arrays
4. **`src/types/index.ts`** — any type or interface definitions
5. **`src/app/analysis/page.tsx` — `STATS_COLUMNS`** — the `id: 'attack_normal_ratio'` field on the second `attack_median` column must remain as-is
6. **`src/components/ui/DataTable.tsx`** — the `id?: string` field on `Column<T>`, and the `key={(col.id ?? col.key) as string}` pattern in both `<th>` and `<td>` renders
7. **Chart tooltip `contentStyle`** — Recharts requires literal hex values for background/border inside tooltip contentStyle objects; do not replace these with CSS vars
8. **All Python files** under `d:\Intrusion-detection-system\ML Models\` — completely out of scope
9. **`src/app/page.tsx`** — the redirect to `/home` must remain unchanged

---

## New CSS Variables Added to globals.css

```css
/* New in FEAT-001 */
--surface-raised: #0C1E35;
--surface-inset: #040E1A;
--glow-blue: rgba(59,130,246,0.15);
--glow-violet: rgba(139,92,246,0.15);
--transition-base: 150ms ease;
```

## CHART_COLORS Replacement Values

```typescript
export const CHART_COLORS = {
  attack:    '#F87171',   // unchanged semantics
  normal:    '#34D399',   // unchanged semantics
  high:      '#F87171',
  moderate:  '#FBBF24',
  low:       '#34D399',
  lr:        '#38BDF8',
  rf:        '#FB923C',
  hybrid:    '#A78BFA',
  primary:   '#60A5FA',
  secondary: '#A78BFA',
  grid:      '#1A3352',   // changed: was '#1e293b', now matches --border token
  text:      '#8FA3B8',   // changed: was '#94a3b8', matches --text-secondary
  gridLight: '#0F2037',   // NEW — for subtle grid lines
  muted:     '#3D5475',   // NEW — for muted labels
} as const;
```

## Which Components Need Token Updates vs Full Rewrites

| Component | Action |
|---|---|
| `globals.css` | Token additions only (no rewrites) |
| `utils.ts` CHART_COLORS | Values replacement only |
| `Sidebar.tsx` | Token + text tweaks — no JSX restructure |
| `Navbar.tsx` | Token + minor JSX addition (accent bar span) |
| `DashboardLayout.tsx` | No changes |
| `StatCard.tsx` | Token updates + minor bottom gradient line addition |
| `ChartCard.tsx` | Token updates + header gradient |
| `PageHeader.tsx` | Typography size bump + dot badge + divider |
| `RiskBadge.tsx` | No changes (already uses CSS vars correctly) |
| `DataTable.tsx` | Token substitution only — all logic preserved |
| `ConfusionMatrix.tsx` | Token substitution + opacity boost |
| `FeatureImportance.tsx` | Token substitution + accessibility title attr |
| `PredictionCard.tsx` | Token substitution |
| `ModelCard.tsx` | Token substitution |
| `FileUpload.tsx` | Token substitution |
| `EnsembleUpload.tsx` | Token substitution |
| `EnsembleResults.tsx` | Token substitution |
| `ProbabilityHistogram.tsx` | Axis label addition (targeted addition, not rewrite) |
| `AttackCategoryChart.tsx` | No changes needed |
| `AttackDistributionChart.tsx` | No changes needed |
| `RiskDistributionChart.tsx` | No changes needed |
| `TimelineChart.tsx` | No changes needed |
| `home/page.tsx` | Targeted additions (new section, badge text, nav button gradient) |
| All 9 dashboard pages | Subtitle string updates + hardcoded hex → var() substitution |

---

## Build Verification Steps

1. `cd d:\Intrusion-detection-system\ids-dashboard && npm run build` — must exit 0 with no TS or ESLint errors
2. Run `npm run dev` and manually verify each route loads without console errors:
   - `/home`, `/overview`, `/primary-model`, `/secondary-model`, `/ensemble`, `/comparison`, `/analysis`, `/performance`, `/results`, `/configuration`
3. On `/primary-model` and `/secondary-model`: upload a CSV and confirm the `ProbabilityHistogram` renders with both axis labels visible ("Hybrid Score (calibrated)" on X, "Row Count" on Y)
4. On `/analysis`: verify the feature stats DataTable renders the "Ratio A/N" column correctly (confirming `id='attack_normal_ratio'` key override is intact)
5. On `/home`: confirm "Key Results at a Glance" section appears and the primary NavButton shows a blue-to-violet gradient
