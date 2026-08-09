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
