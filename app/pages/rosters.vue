<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import type { Column } from "@tanstack/vue-table";
import { upperFirst } from "scule";

definePageMeta({ layout: "authenticated" });

const { auth } = useAuth();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;

onMounted(() => setSubtitle("Rosters"));

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");

// ── Raw API types ─────────────────────────────────────────────────────────────
interface Snapshot {
  weekNumber: number; year: number; job: string; classRole: string;
  patk: number; matk: number; ignorePdef: number; ignoreMdef: number;
  eqPdef: number; eqMdef: number; eqPdefPct: number; eqMdefPct: number;
  rawPdef: number; rawMdef: number;
  pDmgPct: number; pDmgReductionPct: number; mDmgPct: number; mDmgReductionPct: number;
  dmgVsDemiHuman: number; dmgReductionVsDemiHuman: number;
  dmgVsMedium: number; dmgReductionVsMedium: number;
  pvpDmg: number; pvpDmgReduction: number;
}
interface PlayerRow { id: number; ign: string; playerId: string; role: string | null; snapshot: Snapshot | null; }

// ── Flat row for UTable ───────────────────────────────────────────────────────
interface FlatRow {
  id: number; ign: string; playerId: string; role: string; week: string; weekNumber: number | null; weekYear: number | null; jobClass: string;
  patk: number; matk: number; ignorePdef: number; ignoreMdef: number;
  eqPdef: number; eqMdef: number; eqPdefPct: number; eqMdefPct: number;
  rawPdef: number; rawMdef: number;
  pDmgPct: number; pDmgReductionPct: number; mDmgPct: number; mDmgReductionPct: number;
  dmgVsDemiHuman: number; dmgReductionVsDemiHuman: number;
  dmgVsMedium: number; dmgReductionVsMedium: number;
  pvpDmg: number; pvpDmgReduction: number;
}

// ── Data ─────────────────────────────────────────────────────────────────────
const players = ref<PlayerRow[]>([]);
const loading = ref(true);
const errorMsg = ref<string | null>(null);

async function fetchPlayers() {
  try {
    const res = await $fetch<{ players: PlayerRow[] }>(`${backendUrl}/api/players/members`);
    players.value = res.players;
  } catch {
    errorMsg.value = "Failed to load roster.";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchPlayers);

const search = ref("");

const ACTIVE_ROW_TEXT_CLASS = "text-sky-300";
const STALE_ROW_TEXT_CLASS = "text-muted";

function getIsoWeekParts(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function isoWeekStartDate(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return weekStart;
}

const nowIso = getIsoWeekParts(new Date());
const currentWeekStart = isoWeekStartDate(nowIso.year, nowIso.week);

function isWeekOlderThanTwoWeeks(weekYear: number | null, weekNumber: number | null) {
  if (weekYear === null || weekNumber === null) return true;
  const snapshotWeekStart = isoWeekStartDate(weekYear, weekNumber);
  const diffMs = currentWeekStart.getTime() - snapshotWeekStart.getTime();
  return diffMs >= 14 * 24 * 60 * 60 * 1000;
}

function rowTextClass(row: FlatRow) {
  return isWeekOlderThanTwoWeeks(row.weekYear, row.weekNumber)
    ? STALE_ROW_TEXT_CLASS
    : ACTIVE_ROW_TEXT_CLASS;
}

const tableData = computed<FlatRow[]>(() => {
  const q = search.value.trim().toLowerCase();
  return players.value
    .filter((p) => !q || p.ign.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q))
    .map((p) => {
      const s = p.snapshot;
      return {
        id: p.id, ign: p.ign, playerId: p.playerId, role: p.role ?? "—",
        week: s ? `W${s.weekNumber} ${s.year}` : "—",
        weekNumber: s?.weekNumber ?? null,
        weekYear: s?.year ?? null,
        jobClass: s ? `${s.job} — ${s.classRole}` : "—",
        patk: s?.patk ?? 0, matk: s?.matk ?? 0,
        ignorePdef: s?.ignorePdef ?? 0, ignoreMdef: s?.ignoreMdef ?? 0,
        eqPdef: s?.eqPdef ?? 0, eqMdef: s?.eqMdef ?? 0,
        eqPdefPct: s?.eqPdefPct ?? 0, eqMdefPct: s?.eqMdefPct ?? 0,
        rawPdef: s?.rawPdef ?? 0, rawMdef: s?.rawMdef ?? 0,
        pDmgPct: s?.pDmgPct ?? 0, pDmgReductionPct: s?.pDmgReductionPct ?? 0,
        mDmgPct: s?.mDmgPct ?? 0, mDmgReductionPct: s?.mDmgReductionPct ?? 0,
        dmgVsDemiHuman: s?.dmgVsDemiHuman ?? 0, dmgReductionVsDemiHuman: s?.dmgReductionVsDemiHuman ?? 0,
        dmgVsMedium: s?.dmgVsMedium ?? 0, dmgReductionVsMedium: s?.dmgReductionVsMedium ?? 0,
        pvpDmg: s?.pvpDmg ?? 0, pvpDmgReduction: s?.pvpDmgReduction ?? 0,
      };
    });
});

function fmtPct(v: number) { return v === 0 ? "—" : `${v}%`; }
function fmtFlat(v: number) { return v === 0 ? "—" : String(v); }
function fmtFp(v: number)   { return v === 0 ? "—" : v.toFixed(2); }

const UIcon = resolveComponent("UIcon");

function sortIcon(col: Column<FlatRow>) {
  const s = col.getIsSorted();
  if (s === "asc") return "i-lucide-arrow-up-narrow-wide";
  if (s === "desc") return "i-lucide-arrow-down-wide-narrow";
  return "i-lucide-arrow-up-down";
}

function sortableHeader(col: Column<FlatRow>, label: string) {
  return h("div", {
    class: "flex flex-col items-start gap-0.5 cursor-pointer select-none hover:text-slate-200",
    onClick: () => col.toggleSorting(col.getIsSorted() === "asc"),
  }, [
    h("span", { class: "leading-tight" }, label),
    h(UIcon, { name: sortIcon(col), class: "h-3 w-3 opacity-60" }),
  ]);
}
function rightHeader(col: Column<FlatRow>, label: string) {
  return h("div", {
    class: "flex flex-col items-end gap-0.5 cursor-pointer select-none hover:text-slate-200",
    onClick: () => col.toggleSorting(col.getIsSorted() === "asc"),
  }, [
    h("span", { class: "leading-tight text-right" }, label),
    h(UIcon, { name: sortIcon(col), class: "h-3 w-3 opacity-60" }),
  ]);
}

type NumColDef = [string, string, (v: number) => string, boolean?];

const numCols: NumColDef[] = [
  ["patk",                    "PATK",          fmtFlat],
  ["matk",                    "MATK",          fmtFlat],
  ["ignorePdef",              "Ignore PDEF",   fmtFlat],
  ["ignoreMdef",              "Ignore MDEF",   fmtFlat],
  ["eqPdef",                  "EQ PDEF",       fmtFlat],
  ["eqMdef",                  "EQ MDEF",       fmtFlat],
  ["eqPdefPct",               "EQ PDEF %",     fmtPct],
  ["eqMdefPct",               "EQ MDEF %",     fmtPct],
  ["rawPdef",                 "Raw PDEF",      fmtFp, true],
  ["rawMdef",                 "Raw MDEF",      fmtFp, true],
  ["pDmgPct",                 "P DMG %",       fmtPct],
  ["pDmgReductionPct",        "P DMG Red %",   fmtPct],
  ["mDmgPct",                 "M DMG %",       fmtPct],
  ["mDmgReductionPct",        "M DMG Red %",   fmtPct],
  ["dmgVsDemiHuman",          "vs DH %",       fmtPct],
  ["dmgReductionVsDemiHuman", "vs DH Red %",   fmtPct],
  ["dmgVsMedium",             "vs Med %",      fmtPct],
  ["dmgReductionVsMedium",    "vs Med Red %",  fmtPct],
  ["pvpDmg",                  "PVP DMG",       fmtFlat],
  ["pvpDmgReduction",         "PVP Red",       fmtFlat],
];

const columns: TableColumn<FlatRow>[] = [
  {
    accessorKey: "ign",
    header: ({ column }) => sortableHeader(column, "IGN"),
    cell: ({ row }) => h("span", { class: `font-medium ${rowTextClass(row.original as FlatRow)}` }, row.getValue("ign") as string),
  },
  {
    accessorKey: "playerId",
    header: ({ column }) => sortableHeader(column, "Player ID"),
    cell: ({ row }) => h("span", { class: rowTextClass(row.original as FlatRow) }, row.getValue("playerId") as string),
  },
  {
    accessorKey: "role",
    header: ({ column }) => sortableHeader(column, "Role"),
    cell: ({ row }) => h("span", { class: `font-medium ${rowTextClass(row.original as FlatRow)}` }, row.getValue("role") as string),
  },
  {
    accessorKey: "week",
    header: ({ column }) => sortableHeader(column, "Week"),
    cell: ({ row }) => h("span", { class: rowTextClass(row.original as FlatRow) }, row.getValue("week") as string),
  },
  {
    accessorKey: "jobClass",
    header: ({ column }) => sortableHeader(column, "Job Class"),
    cell: ({ row }) => h("span", { class: rowTextClass(row.original as FlatRow) }, row.getValue("jobClass") as string),
  },
  ...numCols.map(([key, label, fmt, highlight]) => ({
    accessorKey: key,
    header: ({ column }: { column: Column<FlatRow> }) => rightHeader(column, label),
    cell: ({ row }: { row: { getValue: (k: string) => number; original: FlatRow } }) => {
      const className = `${highlight ? "font-semibold " : ""}${rowTextClass(row.original)}`.trim();
      return h("span", { class: className }, fmt(row.getValue(key)));
    },
    meta: { class: { th: "text-right", td: "text-right" } },
  })),
];

const sorting = ref([{ id: "ign", desc: false }]);
const columnVisibility = ref<Record<string, boolean>>({});
const tableRef = useTemplateRef("tableRef");

// ── Row context menu ──────────────────────────────────────────────────────────
const contextRow = ref<FlatRow | null>(null);
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const actionError = ref<string | null>(null);

function onTableContextMenu(e: MouseEvent) {
  const tr = (e.target as HTMLElement).closest("tr");
  if (!tr) return;
  const tbody = tr.closest("tbody");
  if (!tbody) return;
  const rowIndex = Array.from(tbody.children).indexOf(tr);
  if (rowIndex < 0) return;
  const allRows = tableRef.value?.tableApi?.getRowModel()?.rows ?? [];
  const tableRow = allRows.find((_, i) => i === rowIndex);
  if (tableRow === undefined) return;
  contextRow.value = tableRow.original as FlatRow;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  menuVisible.value = true;
}

function closeMenu() {
  menuVisible.value = false;
}

async function changePlayerRole(row: FlatRow, role: string) {
  actionError.value = null;
  closeMenu();
  try {
    await $fetch(`${backendUrl}/api/players/${row.id}/role`, {
      method: "PATCH",
      body: { role },
    });
    await fetchPlayers();
  } catch {
    actionError.value = "Failed to update player role. Please try again.";
  }
}

async function deletePlayer(row: FlatRow) {
  actionError.value = null;
  closeMenu();
  try {
    await $fetch(`${backendUrl}/api/players/${row.id}`, { method: "DELETE" });
    await fetchPlayers();
  } catch {
    actionError.value = "Failed to delete player. Please try again.";
  }
}

onMounted(() => {
  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
});
onUnmounted(() => {
  document.removeEventListener("click", closeMenu);
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center gap-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search by IGN or Player ID…"
        class="max-w-sm"
      />
      <UDropdownMenu
        :items="
          tableRef?.tableApi
            ?.getAllColumns()
            .filter((col) => col.getCanHide())
            .map((col) => ({
              label: upperFirst(col.id),
              type: 'checkbox' as const,
              checked: col.getIsVisible(),
              onUpdateChecked(checked: boolean) {
                col.toggleVisibility(!!checked);
              },
              onSelect(e: Event) { e.preventDefault(); },
            }))
        "
        :content="{ align: 'end' }"
      >
        <UButton
          label="Columns"
          color="neutral"
          variant="outline"
          trailing-icon="i-lucide-chevron-down"
        />
      </UDropdownMenu>
    </div>

    <UAlert v-if="errorMsg" color="error" variant="soft" :description="errorMsg" />
    <UAlert v-if="actionError" color="error" variant="soft" :description="actionError" />

    <div @contextmenu.prevent="onTableContextMenu">
      <UTable
        ref="tableRef"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="tableData"
        :columns="columns"
        :loading="loading"
        sticky
        empty="No roster members found."
        :ui="{ base: 'min-w-[1800px]', root: 'overflow-auto rounded-lg border border-slate-800', th: 'whitespace-normal align-bottom', td: 'whitespace-normal align-top' }"
      />
    </div>

    <Teleport to="body">
      <div
        v-if="menuVisible && contextRow"
        class="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        :style="{ top: `${menuY}px`, left: `${menuX}px` }"
        @click.stop
      >
        <button
          v-if="(auth.role === 'Officer' || auth.role === 'Admin') && contextRow.role !== 'Member'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Member')"
        >
          <UIcon name="i-lucide-user-check" class="h-4 w-4 text-green-400" />
          Set as Member
        </button>
        <button
          v-if="(auth.role === 'Officer' || auth.role === 'Admin') && contextRow.role !== 'Officer' && contextRow.role !== 'Admin'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Officer')"
        >
          <UIcon name="i-lucide-shield-half" class="h-4 w-4 text-blue-400" />
          Set as Officer
        </button>
        <button
          v-if="auth.role === 'Admin' && contextRow.role !== 'Admin'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Admin')"
        >
          <UIcon name="i-lucide-crown" class="h-4 w-4 text-yellow-400" />
          Set as Admin
        </button>
        <div class="my-1 border-t border-slate-700" />
        <button
          v-if="auth.role === 'Officer' || auth.role === 'Admin'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
          @click="deletePlayer(contextRow!)"
        >
          <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
          Delete Player
        </button>
      </div>
    </Teleport>
  </div>
</template>
