# ROOCStatDB Frontend

## Development

```bash
yarn install
yarn dev       # http://localhost:3000
```

## Testing

```bash
yarn test              # run all unit tests
yarn test:coverage     # with V8 coverage (composables, components, pages)
```

## Stack

- **Nuxt 4** / Vue 3 / TypeScript
- **@nuxt/ui v4** (Tailwind, dark theme — cyan/slate palette)
- Backend: `NUXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`)

---

## Party Setup page

### Composition Wizard

The Party Composition Wizard is split into two tabs with independent state:

- Objective Focus: picks a target objective and suggests the best full party for that objective.
- Player Focus: analyzes currently selected party members and recommends the best-fit objectives plus accompanying party members.

Player Focus behavior:

- Intent cards show only objectives where matched current-member average score is greater than 0.
- Cards are sorted by average score (then matched count) and limited to top 3.
- The highest ranked card is auto-selected.
- When the party already has 2 or more members, backend suggestions force-include those existing members.

Apply flow:

- The Suggested Players panel has an Apply Suggested Members action.
- On successful apply, the party member list updates and the composition wizard modal closes automatically.

### Event picker

Events are shown in a custom popover-based dropdown (not a native `<select>`).

| Behaviour | Detail |
|---|---|
| Unexpired events | Listed first, white text |
| Expired events | Listed below the action item, rose-coloured text |
| Draft badge | Shown inline on events without a `publishedAt` |
| Date row | Shown per-item below the event name |

**Show / Hide expired** (Officers and Admins only)  
An action row appears between unexpired and expired sections. Clicking it toggles visibility and reopens the dropdown so the user stays in context.

### Role-based layout

| Role | Party list width | Members Pool sidebar |
|---|---|---|
| Member | Full width | Hidden |
| Officer / Admin | Two-column (`1fr 320px` on lg+) | Visible |

### Event actions (Officers / Admins only)

Located in the Parties header row (next to Preview):
- **Publish / Unpublish** — toggles `publishedAt`
- **Edit Event** — updates name, type, date, commanders
- **Clone Event** — copies the event under a new name
- **Delete Event** — permanently removes the event

---

## Build

```bash
yarn build
node .output/server/index.mjs
```

