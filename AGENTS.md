# ROOCStatDB Frontend — Agent Instructions

## Stack

- **Nuxt 4** (Vue 3, TypeScript, Composition API)
- **@nuxt/ui v4** — Tailwind CSS-based component library. Use `UButton`, `UCard`, `UInput`, `USelect`, `UModal`, `UAlert`, etc. Do **not** add a second UI framework.
- Backend URL configured via `NUXT_PUBLIC_BACKEND_URL` env var (default `http://localhost:3001`)

---

## Project structure

```
frontend/
├── nuxt.config.ts
├── .env                          # NUXT_PUBLIC_BACKEND_URL
└── app/
    ├── app.vue                   # Root — <NuxtRouteAnnouncer> + <NuxtPage>
    ├── composables/
    │   └── useAuth.ts            # Auth state, login(), logout()
    └── pages/
        ├── index.vue             # Redirects → /login
        ├── login.vue             # IGN + PlayerID login form
        ├── dashboard.vue         # Member/Officer/Admin landing
        └── applicant.vue         # Applicant landing
```

Auto-imported by Nuxt (no explicit imports needed):
- All files in `app/composables/` → available as `useXxx()`
- All files in `app/components/` → available as `<ComponentName />`
- Nuxt composables: `useState`, `useRuntimeConfig`, `navigateTo`, `useFetch`, `$fetch`, `definePageMeta`, `useRouter`, `useRoute`, `onMounted`, `computed`, `reactive`, `ref`

---

## Reusability rules — follow these strictly

### 1. Extract every repeated UI pattern into a component

Before writing inline markup that has been (or will be) used more than once, create a component in `app/components/`.

Common candidates:
- Page shell with topbar → `app/components/AppShell.vue`
- Role badge → `app/components/RoleBadge.vue`
- Form field (label + input) → `app/components/AppField.vue`
- Error message block → `app/components/AppError.vue`
- Submit button → `app/components/AppButton.vue`

### 2. One composable per concern

| Composable | Responsibility |
|---|---|
| `useAuth` | Auth state, `login()`, `logout()`, `fetchMe()`, `isLoggedIn` |
| `useApi` | Typed `$fetch` wrapper — all backend calls go through this |
| `useCanEdit` | `computed` — true when role is Officer or Admin |
| `useSidebarCounters` | Shared badge counts for sidebar nav |
| `useInactivityLogout` | Auto-logout after 1h of DOM inactivity |
| `useStatSnapshots` | Snapshot fetch helpers |
| `usePageSubtitle` | Page subtitle for the authenticated layout header |

Never put fetch logic directly in a page — put it in a composable or `useApi`.

### 3. Props over slots for simple variation; slots for structural variation

- Simple text/color difference → use a prop
- Different child layout → use a named slot

### 4. Use `definePageMeta` on every page

```vue
<script setup lang="ts">
definePageMeta({ layout: false }); // or a named layout once layouts/ exists
</script>
```

### 5. Guard authenticated pages consistently

Use `definePageMeta({ middleware: 'auth' })` (or `auth-officer`, `auth-admin`, `auth-required`).
Do **not** use `onMounted` guards — route middleware runs before render.

### 6. Typed API responses

All backend response shapes must be typed interfaces in `app/types/` (centralized).

**Import patterns:**
```typescript
import type { LoginResponse, PlayerRole } from '~/app/types';
import { PLAYER_ROLES, isNonMemberRole } from '~/app/types/roles';
```

**BEFORE COMMITTING — if backend types changed:**
1. **Role enum** → Check `backend/lib/roles.ts` — sync with `frontend/app/types/roles.ts`
2. **DTO fields or response shapes** → Update the corresponding type file in `frontend/app/types/`

Never use `any` or `Record<string, unknown>` for API responses.

### 7. Scoped CSS only — when needed

Since `@nuxt/ui` handles most styling via Tailwind, custom `<style>` blocks should be rare. When used, they must be `<style scoped>`. Never use global styles except in `app.vue`.

### 8. Styling with @nuxt/ui

Use `@nuxt/ui` components and Tailwind utilities. The app uses a dark theme — slate/cyan palette.
- Primary colour: `cyan` (set in `app.config.ts`)
- Neutral: `slate`
- Do **not** add raw CSS custom properties for colours — use Tailwind classes instead.

---

## Role system (mirrors backend)

Roles in ascending privilege order: `Applicant < Member < Officer < Admin`

`isMember` returned by the backend = role is **not** Applicant (i.e. Member, Officer, or Admin).

Use `auth.value.role` (string) for role-based UI decisions. Check `auth.value.isMember` for member-gated content.

---

## Auth flow

1. `login.vue` → calls `useAuth().login({ ign, playerId })`
2. `useAuth.login()` → `POST /api/auth/login` on backend
3. Backend auto-registers unknown players (first ever → Admin, rest → Applicant)
4. Backend sets an **HttpOnly JWT cookie** (`access_token`, 1h sliding window)
5. Frontend redirects: `isMember` → `/dashboard`, else → `/applicant`
6. `logout()` calls `POST /api/auth/logout` (clears cookie server-side), clears state, navigates to `/login`

### Session management

- All API calls go through `useApi` which sends `credentials: 'include'` on every request
- The backend `SlidingSessionInterceptor` re-signs the JWT on every authenticated request, resetting the 1h expiry
- `useInactivityLogout` (registered in `app.vue`) fires after **1h of no DOM activity** and calls `logout('inactivity')`
- `useApi` catches **401 responses** and calls `logout('expired')` automatically
- Both redirect to `/login?reason=inactivity` or `/login?reason=expired`, showing a persistent warning toast
- `fetchMe()` on `useAuth` calls `GET /api/auth/me` to refresh role in state after a role change
- `router.afterEach` in `app.vue` calls `fetchMe()` on every navigation so the sidebar updates without re-login

### Role promotion (Applicant → Member)

- `applicant.vue` polls `GET /api/auth/role-check` every 10s (public endpoint, does **not** reset session)
- When `isMember` flips to `true`, the watcher redirects to `/dashboard?welcome=1`
- Dashboard shows a success toast on `?welcome=1`

---

## Environment

```
NUXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Dev server runs on port **3000** by default (`npm run dev`).

---

## Conventions

- `<script setup lang="ts">` on every component and page
- `definePageMeta({ layout: false })` on every page until a shared layout exists
- File names: `kebab-case` for pages, `PascalCase` for components
- No default exports — use `defineComponent` only when options API is unavoidable
- Keep `<template>` → `<script>` → `<style scoped>` order in every SFC

---

## Score System & Rankings

### Guild vs. Class Scores

Players have two score tiers:

1. **Guild Score** — normalized against **all Member/Officer/Admin** players
2. **Class Score** — normalized against players with the **same Job Class + Class Role**

#### Score Calculation

Both use the same 3 categories:
- **Physical**: PATK, Ignore PDEF, P DMG %, DMG vs Demi-Human, DMG vs Medium, PVP DMG
- **Magic**: MATK, Ignore MDEF, M DMG %, DMG vs Demi-Human, DMG vs Medium, PVP DMG  
- **Defensive**: Raw PDEF, Raw MDEF, P/M DMG Reduction %, Reduction vs Demi-Human/Medium, PVP Reduction

Each stat is normalized as `stat_value / max_stat_in_pool`, then **averaged only over stats where at least one player has a non-zero value** (active denominator). Result is converted to 0–100%.

> **Note:** A player who is the only one in their class group will always score 100 on every stat, since they are both the value and the max.

### Rankings

Each score type (physical/magic/defense) has two ranks:
- **Class Rank** (primary in UI) — position among same Job+Class players
- **Guild Rank** (secondary) — position among all Member+ players

Ranks use latest snapshot only for each player.

#### Type Definitions

```ts
// app/components/PlayerProgressionModal.vue
interface ScoreSet { physical: number; magic: number; defensive: number; }
interface ScoresResponse {
  current: ScoreSet | null;
  previous: ScoreSet | null;
  classCurrent?: ScoreSet | null;
  classPrevious?: ScoreSet | null;
}
interface RankSet { rank: number; total: number; }
interface ScopedRank { guild: RankSet; classRole: RankSet; }
interface RankResponse {
  physical: ScopedRank | null;
  magic: ScopedRank | null;
  defensive: ScopedRank | null;
}
```

---

## Roster Page (`rosters.vue`)

### Features

1. **Member Listing** — paginated, sortable, filterable table
2. **Stat Display** — shows player's latest snapshot (job, class role, all stats)
3. **Class & Guild Scores** — both visible, with toggle visibility
4. **Filters**:
   - Search by IGN or Player ID
   - Job Class filter
   - Class Role filter
   - **Outdated Stats** toggle (shows members missing updates in last 2 ISO weeks)
5. **Row Click** — opens `PlayerProgressionModal`
6. **Context Menu** (Officer/Admin only) — role change, delete player
7. **Columns Dropdown** — toggle visibility of all stat columns

### Column Visibility Defaults

Hidden by default:
- Week (snapshot week/year)
- Guild Physical/Magic/Defense Scores
- EQ PDEF, EQ MDEF, EQ PDEF %, EQ MDEF %

Visible by default:
- Class Physical/Magic/Defense Scores
- All raw stat columns (PATK, MATK, ignore, defenses, damage types, PVP)

### Latest Snapshot Filtering

When filtering by Job or Class Role, the backend:
1. Fetches all players matching role + search
2. Loads each player's **latest snapshot only** (via Prisma `distinct: ["playerId"]`)
3. Filters mapped players by current snapshot's job/classRole
4. Returns paginated result

This ensures players who changed class don't show up when filtering for their old class.

### Outdated Stats Filter

- Marks a player as outdated if their latest snapshot is **not** in the current or previous ISO week
- Includes players with **no snapshot at all**
- Applied server-side; affects total count and pagination

---

## Progression Modal (`PlayerProgressionModal.vue`)

### Display

1. **Header** — IGN, week comparison (W#, year)
2. **Class Scores Section**:
   - 3 columns (Physical, Magic, Defense)
   - Each shows score % and both ranks (Class rank first, Guild rank second)
   - No weekly delta displayed
3. **Job/Class Info** — current job, role; flags if changed since previous week
4. **Stats by Group** — Offense, Defense, vs Targets, PVP
   - Shows current value and delta since previous week

### Data Sources

- Snapshots: `GET /api/players/:id/snapshots` (latest 2)
- Scores: `GET /api/players/:id/scores` (includes `classCurrent`, `classPrevious`)
- Ranks: `GET /api/players/:id/rank` (scoped by guild and classRole)

---

## Sidebar Badge System (`authenticated.vue`)

### Badge Counters

- **Dashboard** — blue badge (placeholder, currently 0)
- **Rosters** — red badge showing count of members missing this week's stats
- **Applicants** — blue badge showing count of applicant stat submissions this week
- **Management** — blue badge (placeholder, currently 0)

### Implementation

Counters fetched on mount via `useSidebarCounters` composable:
- `GET /api/players/members-missing-stats-count`
- `GET /api/players/applicant-stats-count`

Counters are refreshed automatically after role changes (applicants.vue and rosters.vue call `refreshAll()`).

---

## API Query Parameters

### `GET /api/players/members` (and `/non-members`)

Supported params:
- `page` (1-indexed)
- `pageSize`
- `search` (IGN or PlayerID)
- `job` (Job Class name)
- `classRole` (Class Role name)
- `outdatedOnly` (`"1"` or `"true"` for filtering)
- `sortBy` (field name; snapshot fields sorted in-memory)
- `sortDir` (`"asc"` or `"desc"`)

When `job` or `classRole` is set, filtering uses latest snapshot only (server-side in-memory after DB fetch).

---

## Stat Builds (`StatSnapshotForm.vue`)

Members can have **multiple stat build profiles** (e.g. Main, PVP, Support).

- Each build is a `PlayerStatBuild` record on the backend
- Every player gets a **"Main" default build** automatically on registration
- The build selector appears in the `StatSnapshotForm` card header (split button + popover)
- Switching builds loads that build's latest snapshot; saving writes to the selected build
- Applicants do **not** have build management (`showBuilds: false` prop on `StatSnapshotForm`)
- For all guild-wide features (rosters, rankings, party setup, comparison), only the **default build** snapshot is used

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stat-snapshots/builds` | List my builds |
| `POST` | `/api/stat-snapshots/builds` | Create a build |
| `PATCH` | `/api/stat-snapshots/builds/:id/rename` | Rename |
| `PATCH` | `/api/stat-snapshots/builds/:id/set-default` | Change default |
| `DELETE` | `/api/stat-snapshots/builds/:id` | Delete (non-default only) |
| `GET` | `/api/stat-snapshots/latest?buildId=X` | Latest snapshot for a specific build |

---

## Common Patterns

### Fetching & Pagination

```ts
const params = {
  page: String(pageIndex.value + 1),
  pageSize: String(pageSize),
  search: search.value || undefined,
  job: filterJob.value || undefined,
};
const qs = new URLSearchParams(params).toString();
const res = await $fetch<{ players: PlayerRow[]; total: number }>(
  `${backendUrl}/api/players/members?${qs}`
);
```

### Filtering on Change

```ts
watch([filterJob, filterClassRole, filterOutdatedOnly], () => {
  pageIndex.value = 0;
  fetchPlayers();
});
```

Reset page to 0, then refetch.

### Scoped Timestamp Calculations

ISO week date calculations are replicated in frontend (for UI logic like staleness) and backend (for query filtering). Both use the same formulas:

```ts
function getIsoWeekParts(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}
```
