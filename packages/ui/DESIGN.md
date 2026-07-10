# AVM Daily — Design System Canonical Spec

**Source:** Claude Design project `044c674b-96dd-4e93-a95d-c7d11a52cea5` ("AVM-Daily") — files `AVM Daily.html`, `avm-app.jsx`, `avm-components.jsx`, `avm-screens-1.jsx`, `avm-screens-2.jsx`, `tweaks-panel.jsx`. Load via `mcp__claude-design__read_file` if in doubt; this document is derived, not authoritative.

Every downstream PR (01–06, N01–N06) composes only these primitives with these tokens.

## Layout targets

- **Mobile (native)** — 390×844 phone frame, bottom nav 5 tabs (Home / Goals / Plus / History / Profile).
- **Desktop (web)** — 248px sidebar + up to 680px main + 280px right stats panel. Sidebar items: Dashboard / Goals / Deposit-Withdraw / Transactions / Compliance / Settings.
- Web mobile viewport not covered by design → fall back to a stack of the same content, sidebar collapsed to a top-nav drawer.

## Naming (design vs roadmap)

Design copy wins for user-facing strings:

| Roadmap term | Design term |
|---|---|
| Savings plans | **Goals** |
| Transactions | **History** (mobile) / **Transactions** (desktop) |
| Withdrawal | **Withdraw** (tab inside Deposit screen) |
| Deposit | **Deposit** (tab) |
| KYC | **Compliance** (desktop) / **Verify Identity** (mobile screen title) |
| User dashboard | **Dashboard** (desktop) / **Home** (mobile tab) |

## Themes

Three themes ship at v1. Design source is JSX with inline styles; we encode as CSS custom properties.

| Theme | Selector | Kind | Default? |
|---|---|---|---|
| `midnight` | `.dark`, `:root[data-theme="midnight"]` | dark navy | **yes** |
| `daylight` | `:root`, `:root[data-theme="daylight"]` | light blue | when `.dark` absent |
| `indigo` | `:root[data-theme="indigo"]`, `.dark[data-theme="indigo"]` | dark purple | opt-in |

Theme switcher lives in `SettingsScreen` (v1) mirroring the design's Tweaks panel intent.

### Token map — source of truth

Every entry lists **design JS key → CSS custom property**. Values are the hex/rgba as authored in `avm-components.jsx` `THEMES` object.

Extended tokens not in stock shadcn palette are marked ✱ — additive, not replacements.

| Design | CSS var | midnight | indigo | daylight |
|---|---|---|---|---|
| `bg` | `--background` | `#060c1c` | `#08091a` | `#f0f4ff` |
| `card` | `--card` | `#0c1930` | `#0f1030` | `#ffffff` |
| `surface` | `--secondary` ✱ (reused) | `#0f1e3a` | `#151640` | `#e4eaff` |
| `border` | `--border` | `rgb(255 255 255 / 0.07)` | `rgb(255 255 255 / 0.07)` | `rgb(10 30 80 / 0.10)` |
| `primary` | `--primary` | `#3b7fff` | `#7c5cfc` | `#2563eb` |
| `primaryDim` | `--primary-dim` ✱ | `rgb(59 127 255 / 0.14)` | `rgb(124 92 252 / 0.14)` | `rgb(37 99 235 / 0.10)` |
| `teal` | `--accent` | `#00c6a9` | `#38bdf8` | `#0891b2` |
| `text` | `--foreground` | `#e8f0ff` | `#f0f0ff` | `#0a1628` |
| `muted` | `--muted-foreground` | `rgb(232 240 255 / 0.52)` | `rgb(240 240 255 / 0.52)` | `rgb(10 22 40 / 0.52)` |
| `subtle` | `--subtle` ✱ | `rgb(232 240 255 / 0.26)` | `rgb(240 240 255 / 0.26)` | `rgb(10 22 40 / 0.30)` |
| `success` | `--success` ✱ | `#10d98e` | `#34d399` | `#059669` |
| `successDim` | `--success-dim` ✱ | `rgb(16 217 142 / 0.14)` | `rgb(52 211 153 / 0.14)` | `rgb(5 150 105 / 0.10)` |
| `warning` | `--warning` ✱ | `#ffb340` | `#fbbf24` | `#d97706` |
| `warningDim` | `--warning-dim` ✱ | `rgb(255 179 64 / 0.14)` | `rgb(251 191 36 / 0.14)` | `rgb(217 119 6 / 0.10)` |
| `danger` | `--destructive` | `#ff5c5c` | `#f87171` | `#dc2626` |
| `dangerDim` | `--destructive-dim` ✱ | `rgb(255 92 92 / 0.14)` | `rgb(248 113 113 / 0.14)` | `rgb(220 38 38 / 0.10)` |
| `navBg` | `--nav-bg` ✱ | `#080e20` | `#060714` | `#ffffff` |
| `inputBg` | `--input` | `rgb(255 255 255 / 0.05)` | `rgb(255 255 255 / 0.05)` | `rgb(10 30 80 / 0.04)` |
| `balanceGrad` | `--gradient-balance` ✱ | see below | see below | see below |

Balance gradients (used on hero card + profile hero + goals summary):
- midnight — `linear-gradient(140deg, #0a1f60 0%, #1535a8 50%, #091850 100%)`
- indigo — `linear-gradient(140deg, #1a0a4e 0%, #2d1080 50%, #14073c 100%)`
- daylight — `linear-gradient(140deg, #1e3a8a 0%, #2563eb 50%, #1e40af 100%)`

Chart tokens map to semantic slots per theme so chart series read consistently:
`--chart-1 = primary`, `--chart-2 = success`, `--chart-3 = warning`, `--chart-4 = accent (teal)`, `--chart-5 = destructive`.

## Typography

- **Font family — UI** — Inter (400 / 500 / 600 / 700).
- **Font family — numeric + headings** — Noto Sans (400 / 500 / 600 / 700). Applied to any figure (balances, amounts, big titles) via `.font-display` utility.
- **Letter spacing on big numbers** — `-0.025em`.
- **Letter spacing on section titles** — `-0.02em`.
- **Uppercase label pattern** — `font-size: 11–12px; font-weight: 600–700; letter-spacing: 0.07–0.1em; text-transform: uppercase; color: --muted-foreground`.

Load fonts via `@fontsource/inter` + `@fontsource/noto-sans` (offline-first). Not Google Fonts CDN (CSP + offline).

## Radii

- Cards, hero — 18–22px (`rounded-[18px]` / `rounded-[22px]`).
- Buttons (primary / secondary / ghost) — 14px.
- Small pills, chips, inputs — 11–14px.
- Icon backgrounds — 10–13px.
- Pill badges — full round (9999).

## Spacing scale

Follows shadcn/Tailwind default; design uses 20px screen padding, 14–20px section gaps, 12–14px card gap, 10–12px row gap, 4–8px inline gap.

## Motion

Three animations, all with `ease` timing and 220–280ms duration:

```
@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
@keyframes fadeUp      { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes scaleIn     { from { opacity: 0; transform: scale(0.92);      } to { opacity: 1; transform: none; } }
```

- `.screen-anim` — 220ms `fadeSlideIn` — every route transition on both platforms.
- `.fade-up` — 280ms `fadeUp` — reveal-inside-section (e.g. KYC step expand).
- `.scale-in` — 240ms `scaleIn` — success states.
- Button hover — 150ms ease, `translateY(-1px)` plus a `0 6px 24px primary/33%` shadow.
- Progress fill — 800ms ease on `stroke-dashoffset` / `width`.

Respect `prefers-reduced-motion: reduce` — collapse all to instant.

## Primitives (packages/ui components)

Each entry names the exported component and its file. Anything not in this list is **not** part of the atomic set — it's composed by feature PRs.

| Component | File | Notes |
|---|---|---|
| `Icon` | `src/components/icon.tsx` | New. SVG-path registry mirroring the design's 40 icons. Same paths as `ICON_PATHS` in `avm-components.jsx`. Props: `{ name, size?, color?, strokeWidth?, className? }`. |
| `ProgressRing` | `src/components/progress-ring.tsx` | New. SVG circle with `strokeDasharray` + `strokeDashoffset` transition. Props: `{ percent, size?, stroke?, color?, track? }`. |
| `Badge` | `src/components/badge.tsx` | Rewrite variants → `default`, `success`, `warning`, `destructive`, `muted`. Full-round, 3px×10px, 11px/700, `0.04em` tracking. |
| `Button` | `src/components/button.tsx` | Rewrite. Variants → `primary`, `default` (= primary alias), `secondary`, `ghost` + legacy `outline` / `destructive` / `link` for admin. Sizes → `default` (h-7, shadcn compact baseline kept for admin call sites), `md` (h-11 dashboard tiles + form CTAs), `hero` (h-14 onboarding + primary in-flow CTAs — the design's default). Legacy `sm` / `xs` / `lg` and `icon*` sizes retained. Hover — `translateY(-1px)` + primary/33 shadow (primary + default); border-shift only (secondary + ghost). |
| `BalanceGradient` | `src/lib/gradients.ts` | Utility exporting `balanceGradient` CSS-var reference. Consumed by BalanceHero (PR 01) + GoalsSummary (PR 02) + ProfileHero (PR 06+). |
| Existing (unchanged) | `card.tsx`, `input.tsx`, `field.tsx`, `label.tsx`, `separator.tsx`, `skeleton.tsx`, `sonner.tsx`, `checkbox.tsx`, `dropdown-menu.tsx` | Tokens now reflect design; no source changes. |
| Existing (retire) | `calendar-widget.tsx`, `clock-widget.tsx`, `widget.tsx` | Not referenced by any AVM Daily design node. Leave the files but mark them deprecated in a header comment — do not import into any user route. |

Additional shadcn primitives added by their consuming PRs (not PR 00):
- `sheet.tsx`, `dialog.tsx`, `select.tsx`, `date-picker.tsx`, `tabs.tsx`, `avatar.tsx`, `progress.tsx`, `chart.tsx` (Recharts wrapper).

## Icon set

Custom SVG path map imported from `avm-components.jsx` `ICON_PATHS`. **Do not swap for `lucide-react`** — some paths (e.g. `zap`, `layers`, `fingerprint`) are subtly different from Lucide's, and the design is authoritative.

Icons used somewhere in the design (must all export from the registry):

```
home target plus clock user bell eye eye-off chevron-right chevron-left chevron-down
check check-circle shield arrow-down arrow-up arrow-right arrow-left arrow-up-right arrow-down-left
settings log-out lock upload sun moon x search credit-card send trending-up
help-circle alert-circle wallet phone file-text camera gift building fingerprint layers
zap bar-chart more-horizontal refresh-cw
```

## Global CSS

`packages/ui/src/styles/globals.css` — encodes the token map, motion, `.font-display` utility, sets `--font-sans` to Inter and `--font-display` to Noto Sans, imports `@fontsource/inter/{400,500,600,700}.css` + `@fontsource/noto-sans/{400,500,600,700}.css`.

`apps/native/global.css` — mirrors the same theme selectors via Uniwind theme extension. Font is loaded through `expo-font` (see `apps/native/lib/theme.ts`).

## Data shape hints (from screens 1 + 2)

Design data mocks tell us the field names user-facing UI expects. Backend queries already surface most of these; where names differ, adapt in the presentation layer.

- **Goal** — `{ id, name, icon (Icon name), color (hex), current (kobo-scaled), target }`. Backend `savingsPlans.listMine` returns `current_amount_kobo` and `custom_target_kobo` — map through `formatNaira` before render.
- **Transaction** — `{ id, type: 'credit' | 'debit', title, sub (date + time), amount }`. Backend returns richer shape; presentation layer collapses to this.
- **Bank** — `{ id, name, num (masked last 4), color (accent hex per bank) }`. `bankAccounts.listMineMasked` already returns masked digits.

## Screens covered (index)

Design covers: Onboarding (3-step), Dashboard, Goals, Deposit/Withdraw, History, KYC / Compliance, Settings.

Design does **not** cover (blocks PRs 05, 06, N05, N06 — see `.design-sync/NOTES.md`):
- Bank-accounts manage / add / verify uploader as a standalone flow.
- Notification inbox route.
- Notification preferences route.

## Rules for downstream PRs

1. **Compose only primitives from this doc.** If you need something new, extend this doc AND ship the primitive in the same PR.
2. **All amounts formatted via `formatNaira`** — never inline `₦` + `toLocaleString`.
3. **Never invent tokens.** If a value is missing, escalate — do not read the design's inline styles and hardcode.
4. **Icons via `<Icon name="…" />`** — never inline SVG paths outside `icon.tsx`.
5. **Animations via `.screen-anim` / `.fade-up` / `.scale-in`** — never author bespoke keyframes.
6. **Naming — user-facing copy** follows the design; **code identifiers** stay on roadmap terms (`SavingsPlans`, `Withdrawal`, `KYC`) so backend + tests stay grep-able.
