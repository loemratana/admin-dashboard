# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run from `admin-dashboard/` (the whole app lives here; the parent folder holds nothing else).

- `npm run dev`: dev server on http://localhost:3000 (Turbopack). It sometimes keeps serving a stale compiled `globals.css`. If newly used Tailwind classes don't show up, restart it.
- `npm run build` / `npm start`: production build and server.
- `npm run lint`: ESLint (flat config, `eslint-config-next`).
- `npx tsc --noEmit -p .`: type check. Run this together with lint after changes.

There is no test runner, test script or Prettier config in the repo. Don't add formatting tools via `npx`. Code uses long lines (well past 80 characters), double quotes and trailing commas.

## Stack and framework quirks

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript, Zod 4.
  - `cacheComponents` is on: a page that awaits `params`/`searchParams` needs a Suspense boundary. Dynamic routes have a `loading.tsx` next to the page for this.
  - Pages type their props with the global `PageProps<"/route/[param]">`.
- **Tailwind v4** via `@tailwindcss/turbopack` (see `next.config.ts`). Design tokens are CSS variables in `src/app/globals.css`, mapped with `@theme inline`.
  - Components use token classes (`bg-card`, `text-muted-foreground`, `border-border`) rather than raw colors.
  - Dark mode is a `.dark` class set by `next-themes`.
- **shadcn on Base UI (`base-nova` style)**, not Radix (`components/ui/*`, configured in `components.json`).
  - Use the `render` prop, not `asChild` (e.g. `<DialogClose render={<Button />}>`).
  - The `Select` needs an `items` prop to show labels; most forms use a native `<select>` instead.
  - For navigation that looks like a button, use `components/shared/link-button.tsx`, not `Button` rendered as a link.
- Next keeps visited pages mounted (hidden) during client navigation. Consequences:
  - Element ids must come from `useId()`, never hardcoded.
  - Dialogs/forms that navigate away must close themselves first, or they're still open when you come back.

## Architecture

Frontend-only for now: there is no backend. Feature folders follow `features/<name>/{api,hooks,components,types,utils,schemas,policies}`. Route files in `app/(dashboard)/…` stay thin: they wrap a feature component in `RequirePermission`.

**Data layer: in-memory stores standing in for a backend.**
- `lib/create-store.ts` provides `createStore` and `useStore`, built on `useSyncExternalStore`. State is seeded in each feature's `api/` module, survives client navigation and resets on reload.
- Each `features/*/api/*.ts` module acts as the backend. It validates the actor's permissions and the business rules and throws a typed error (`StockError`, `ApprovalError`, `AccessError`…). Components call these async functions and show `error.message`.
- The UI hiding a button is never the enforcement.
- Hooks in `features/*/hooks` only read stores and derive data.

**Access control (`config/permissions.ts`, `lib/authorization.ts`, `features/access-control`).**
- Permission keys are `module.resource.action`. The `PermissionKey` type is derived from the catalog.
- Roles grant keys with a scope: `all | warehouse | assigned | own`. `can(user, roles, permission, record?)` is pure and shared by the api modules and the UI (`useCan`, `RequirePermission`, `<Can>`).
- The current user is simulated with `currentUserIdStore`. The user menu has a "view as" switcher; the default user is u-02, Sam Rivera (Admin).
- Separation of duties is enforced throughout: requesters don't approve their own requests, and nobody grants access they don't hold.

**Events and audit.** `lib/events.ts` is a typed event bus. API modules emit events such as `stock.*`, `approval.*` and `user.*`; `features/access-control/api/audit-api.ts` listens and records the audit log. Add new event types to both files.

**Stock is an append-only ledger (`features/stock`).**
- Movements carry variant, warehouse, bin (`locationId`), bucket (`available | reserved | damaged | quarantined`) and a signed quantity.
- Levels are always computed from movements (`utils/stock-math.ts`), never stored.
- `appendMovements` in `ledger-store.ts` refuses any posting that would make a balance negative.
- Goods in transit sit in the pseudo-warehouse `IN_TRANSIT`, with `locationId` set to the transfer id.
- Stock is per product variant; simple products have one default variant.
- Warehouses with `trackBins` require a bin on every movement. Bin rules (active, category, capacity) are in `warehouses/api/locations-api.ts` (`placementProblem`).

**Approval engine (`features/approvals`).**
- Modules submit requests with *facts* (warehouse, destination, value at cost, quantity, reason, whether it's a bin move) and *evidence* (note, details, documents). The first matching active rule, in priority order, sets the levels, approvers, escalation, segregation and evidence requirements.
- A request keeps a copy of its rule's levels and requirements, so later rule edits don't change it. Its decision history is frozen and append-only.
- Each module registers what a decision does via `registerApprovalHandler(kind, { approved, rejected, returned })`, in `approval-handlers.ts` (no imports, to avoid cycles).
  - The final approval runs the module's `approved` handler *before* the decision is recorded. If it throws (e.g. stock ran out), nothing is recorded.
  - Rules with zero levels (allowed only for bin-to-bin transfers) approve immediately on submission.
- Connected so far: stock adjustments (`stock/api/stock-api.ts`) and transfers (`transfers/api/transfers-api.ts`). When connecting a kind, also add it to `liveKinds` and import its api module in `approvals/connected-modules.ts`.
- Notifications (`features/notifications`) go to an outbox store through per-channel providers (email, Telegram). Sending is simulated until a backend exists.
- Escalation runs client-side (`runEscalations`, on a timer while the approvals UI is mounted, and before each decision).

**Navigation** is config-driven (`config/navigation.ts`): groups and links with optional `permission` and `available: false` (shown as "Soon"). `sidebar-nav.tsx` filters links by permission and highlights the most specific match. Breadcrumbs come from URL segments; `useBreadcrumbLabel(href, label)` overrides one, for example to show a record number.

## Conventions

- Comments explain *why*, briefly; match the density of the surrounding file.
- User-facing errors are plain sentences that say what to do, thrown from the api layer.
- Seed data uses fixed ids (`u-01`…`u-11`, `wh-main`, `wh-east`, `wh-cdc` (bin-tracked), `wh-annex` (inactive), `prd-0001`…, `var-prd-0001-0`…). Other code and checks rely on them, so keep them stable.
- `pattern-desgin.md` and `strutur.md` are the user's notes on the intended patterns (Composition, configuration-driven, Adapter, Provider, Strategy) and the folder layout. `lib/api-client.ts` is where a real backend client will go.
