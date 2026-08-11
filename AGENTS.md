# ROOCStatDB Frontend — Agent Instructions

## Stack

- **Nuxt 4** (Vue 3, TypeScript, Composition API)
- **No UI library** — plain scoped CSS, dark theme (`#0f172a` bg, `#1e293b` card, `#6366f1` accent)
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
| `useAuth` | Auth state, `login()`, `logout()`, `isLoggedIn` |
| `useApi` *(add when needed)* | Typed `$fetch` wrapper for backend endpoints |

Never put fetch logic directly in a page — put it in a composable or the `useApi` wrapper.

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

```ts
onMounted(() => {
  if (!auth.value.player) navigateTo("/login");
});
```

Do not duplicate this — put it in a route middleware (`app/middleware/auth.ts`) once there are 2+ guarded pages.

### 6. Typed API responses

All backend response shapes must be typed interfaces in `app/composables/useAuth.ts` or a dedicated `app/types/` file if they grow beyond auth. Never use `any` or untyped `$fetch`.

### 7. Scoped CSS only

All `<style>` blocks must be `<style scoped>`. Never use global styles except in `app.vue` for resets.

### 8. Color / spacing tokens

Use these CSS custom properties instead of hard-coded values (add to `app.vue` `:root` when you first need them):

```css
--color-bg:       #0f172a;
--color-surface:  #1e293b;
--color-border:   #334155;
--color-muted:    #94a3b8;
--color-text:     #f1f5f9;
--color-accent:   #6366f1;
--color-accent-h: #4f46e5;
--color-warn:     #f59e0b;
--color-error:    #f87171;
```

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
4. Frontend redirects: `isMember` → `/dashboard`, else → `/applicant`
5. `logout()` clears state and navigates to `/login`

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

Each stat is normalized as `stat_value / max_stat_in_pool`, then averaged across all stats (fixed denominator, even if max=0). Result is converted to 0–100%.

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

Counters fetched on mount via separate endpoints:
- `GET /api/players/members-missing-stats-count`
- `GET /api/players/applicant-stats-count`

Each nav item includes `badgeClass` (color class: `bg-red-500` or `bg-sky-500`).

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
