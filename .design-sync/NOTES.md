# Design-sync notes

Persistent decisions + gaps for future runs.

## 2026-07-07 — first-time analysis (pre-sync)

Skill invoked to determine sync viability. Sync itself deferred until PR 00 tokens land (`packages/ui` will be design-lifted, no point syncing pre-lift primitives). See task #15.

## Design source

- Project: `044c674b-96dd-4e93-a95d-c7d11a52cea5` "AVM-Daily" (claude.ai/design).
- Files:
  - `AVM Daily.html` — shell (fonts + CSS reset + animation keyframes + Babel entry).
  - `avm-app.jsx` — App root, phone frame, desktop layout, bottom nav, sidebar, right stats panel, Tweaks panel wiring.
  - `avm-components.jsx` — Themes + `fmt`/`fmtShort` + `Icon` + `ProgressRing` + `Badge` + `Btn`.
  - `avm-screens-1.jsx` — Onboarding, Dashboard, Goals.
  - `avm-screens-2.jsx` — Deposit/Withdraw, History, KYC, Settings.
  - `tweaks-panel.jsx` — Claude Design host-protocol tweaks harness (design-authoring only, not part of app).

## Decisions locked

- **Themes** — ship all 3 (midnight / indigo / daylight). Midnight default (`.dark`), daylight `:root`, indigo `:root[data-theme="indigo"]`. Theme picker lands in Settings screen.
- **Chart lib (web)** — shadcn Chart wrapper on Recharts.
- **Chart lib (native)** — `victory-native` XL + `@shopify/react-native-skia` (installed in PR N01).
- **Font loading** — `@fontsource/inter` + `@fontsource/noto-sans` (offline-first). NOT Google Fonts CDN.
- **Icon set** — hand-authored SVG-path registry, not `lucide-react`. Some design icons diverge from Lucide paths.
- **User-facing copy** — design terms (Goals / History / Compliance / Deposit-Withdraw) win. Code identifiers stay on roadmap terms (`SavingsPlans`, `Withdrawal`, `KYC`) for grep-ability.
- **Delivery flow** — 6-PR web Graphite stack + 6-PR native stack, native lags web by 1 PR. Feature-flagged behind PostHog `user_dashboard_v1`.

## Design gaps (blocks specific PRs)

Design does not cover these screens. See tasks #16 + #17 (designer to add). Downstream PRs pause until design lands.

- **Banks manage (roadmap §7.5)** — banks appear inline in Deposit screen only. Need: list, add-form, verification uploader detail, primary-toggle. Blocks PR 05 + PR N05.
- **Notifications (roadmap §7.6)** — bell + red dot on Dashboard header only. Need: inbox route, notification detail, preferences form (channel + category toggles). Blocks PR 06 + PR N06.

## Coverage variance vs roadmap

- Design merges deposit + withdraw + transfer into a single `DepositScreen` with a tab toggle. Roadmap §7.4 assumed a separate withdrawal flow. Implementation: keep the merged deposit-screen UX on the client; backend withdrawal path (`withdrawals.request`) is still hit from the "Withdraw" tab.
- Design has no plan-create-from-template flow (only list). PR 02 designs the create flow using existing primitives (design gap noted here).

## Runtime protocol notes

- `tweaks-panel.jsx` uses `postMessage` `__edit_mode_*` protocol. Not part of shipped app.
