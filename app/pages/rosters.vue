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

onMounted(() => {
  if (!auth.value.player) { navigateTo("/login"); return; }
  if (auth.value.role === "Applicant" || auth.value.role === "Waitlisted") { navigateTo("/applicant"); return; }
  setSubtitle("Rosters");
});

const UButton = resolveComponent("UButton");
const UDropdownMenu = resolveComponent("UDropdownMenu");
const UBadge = resolveComponent("UBadge");

const ROLE_PILL: Record<string, { color: string; variant: string }> = {
  Waitlisted: { color: "warning",  variant: "soft" },
  Officer:    { color: "info",     variant: "soft" },
  Admin:      { color: "error",    variant: "soft" },
};

function roleCell(row: FlatRow) {
  const role = row.role;
  const pill = ROLE_PILL[role];
  if (pill) return h(UBadge, { color: pill.color, variant: pill.variant, size: "sm" }, () => role);
  return h("span", { class: `font-medium ${rowTextClass(row)}` }, role);
}

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
  healingDone: number; healingTaken: number;
}
interface PlayerRow {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  isFirstPlayer: boolean;
  snapshot: Snapshot | null;
  scores: { physical: number; magic: number; defensive: number } | null;
  classScores: { physical: number; magic: number; defensive: number } | null;
}

// ── Flat row for UTable ───────────────────────────────────────────────────────
interface FlatRow {
  id: number; ign: string; playerId: string; role: string; isFirstPlayer: boolean; week: string; weekNumber: number | null; weekYear: number | null; jobClass: string; job: string; classRole: string;
  patk: number; matk: number; ignorePdef: number; ignoreMdef: number;
  eqPdef: number; eqMdef: number; eqPdefPct: number; eqMdefPct: number;
  rawPdef: number; rawMdef: number;
  pDmgPct: number; pDmgReductionPct: number; mDmgPct: number; mDmgReductionPct: number;
  dmgVsDemiHuman: number; dmgReductionVsDemiHuman: number;
  dmgVsMedium: number; dmgReductionVsMedium: number;
  pvpDmg: number; pvpDmgReduction: number;
  healingDone: number; healingTaken: number;
  physicalScore: number; magicScore: number; defensiveScore: number;
  classPhysicalScore: number; classMagicScore: number; classDefensiveScore: number;
}

// ── Data ─────────────────────────────────────────────────────────────────────
const players = ref<PlayerRow[]>([]);
const total = ref(0);
const loading = ref(true);
const errorMsg = ref<string | null>(null);

const search = ref("");
const filterJob = ref<string | null>(null);
const filterClassRole = ref<string | null>(null);
const filterOutdatedOnly = ref(false);
const pageIndex = ref(0);
const pageSize = 20;
const sorting = ref([{ id: "ign", desc: false }]);

async function fetchPlayers() {
  loading.value = true;
  errorMsg.value = null;
  try {
    const params: Record<string, string> = {
      page: String(pageIndex.value + 1),
      pageSize: String(pageSize),
    };
    if (search.value.trim()) params.search = search.value.trim();
    if (filterJob.value) params.job = filterJob.value;
    if (filterClassRole.value) params.classRole = filterClassRole.value;
    if (filterOutdatedOnly.value) params.outdatedOnly = "1";
    if (sorting.value[0]) {
      params.sortBy = sorting.value[0].id;
      params.sortDir = sorting.value[0].desc ? "desc" : "asc";
    }
    const qs = new URLSearchParams(params).toString();
    const res = await $fetch<{ players: PlayerRow[]; total: number }>(`${backendUrl}/api/players/members?${qs}`);
    players.value = res.players;
    total.value = res.total;
  } catch {
    errorMsg.value = "Failed to load roster.";
  } finally {
    loading.value = false;
  }
}

// ── Filter options from ref-data ──────────────────────────────────────────────
interface RefItem { id: number; name: string }
const allJobs = ref<RefItem[]>([]);
const allClassRoles = ref<RefItem[]>([]);

onMounted(async () => {
  if (window.innerWidth < 640) {
    columnVisibility.value = { ...SMALL_COLUMN_VISIBILITY };
  } else if (window.innerWidth < 1024) {
    columnVisibility.value = { ...MOBILE_COLUMN_VISIBILITY };
  } else if (window.innerWidth < 1280) {
    columnVisibility.value = { ...MEDIUM_COLUMN_VISIBILITY };
  } else {
    columnVisibility.value = { ...DESKTOP_COLUMN_VISIBILITY };
  }
  const [jobs, classRoles] = await Promise.all([
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/job-classes`).catch(() => []),
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/class-roles`).catch(() => []),
  ]);
  allJobs.value = jobs;
  allClassRoles.value = classRoles;
  await fetchPlayers();
});

watch([filterJob, filterClassRole, filterOutdatedOnly], () => {
  pageIndex.value = 0;
  fetchPlayers();
});

watch(pageIndex, fetchPlayers);
watch(sorting, () => { pageIndex.value = 0; fetchPlayers(); }, { deep: true });

let _searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (_searchTimer) clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    pageIndex.value = 0;
    fetchPlayers();
  }, 300);
});

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

const tableData = computed<FlatRow[]>(() =>
  players.value.map((p) => {
    const s = p.snapshot;
      return {
        id: p.id, ign: p.ign, playerId: p.playerId, role: p.role ?? "—", isFirstPlayer: p.isFirstPlayer,
        week: s ? `W${s.weekNumber} ${s.year}` : "—",
        weekNumber: s?.weekNumber ?? null,
        weekYear: s?.year ?? null,
        jobClass: s ? `${s.job} — ${s.classRole}` : "—",
        job: s?.job ?? "—",
        classRole: s?.classRole ?? "—",
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
        healingDone: s?.healingDone ?? 0, healingTaken: s?.healingTaken ?? 0,
        physicalScore: p.scores?.physical ?? 0,
        magicScore: p.scores?.magic ?? 0,
        defensiveScore: p.scores?.defensive ?? 0,
        classPhysicalScore: p.classScores?.physical ?? 0,
        classMagicScore: p.classScores?.magic ?? 0,
        classDefensiveScore: p.classScores?.defensive ?? 0,
      };
    })
);

const jobOptions = computed(() => [
  { label: "All Jobs", value: null },
  ...allJobs.value.map(j => ({ label: j.name, value: j.name })),
]);

const classRoleOptions = computed(() => [
  { label: "All Roles", value: null },
  ...allClassRoles.value.map(r => ({ label: r.name, value: r.name })),
]);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));

const pageLabel = computed(() => {
  if (total.value === 0) return "No results";
  const start = pageIndex.value * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total.value);
  return `${start}–${end} of ${total.value}`;
});

watch([search, filterJob, filterClassRole, filterOutdatedOnly], () => { pageIndex.value = 0; });

function fmtPct(v: number) { return v === 0 ? "—" : `${v}%`; }
function fmtFlat(v: number) { return v === 0 ? "—" : String(v); }
function fmtFp(v: number)   { return v === 0 ? "—" : v.toFixed(2); }
function fmtScore(v: number) { return v === 0 ? "—" : `${v.toFixed(1)}%`; }

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
  ["healingDone",             "Healing Done %", fmtPct],
  ["healingTaken",            "Healing Taken %", fmtPct],
  ["physicalScore",           "Guild Physical Score", fmtScore, true],
  ["magicScore",              "Guild Magic Score",    fmtScore, true],
  ["defensiveScore",          "Guild Defense Score",  fmtScore, true],
  ["classPhysicalScore",      "Class Physical Score", fmtScore, true],
  ["classMagicScore",         "Class Magic Score",    fmtScore, true],
  ["classDefensiveScore",     "Class Defense Score",  fmtScore, true],
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
    cell: ({ row }) => roleCell(row.original as FlatRow),
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

const tableColumns = computed(() => {
  if (auth.value.role === "Member") {
    return columns.filter((col) => {
      if ("accessorKey" in col) {
        return col.accessorKey !== "playerId";
      }
      return true;
    });
  }
  return columns;
});

const DESKTOP_COLUMN_VISIBILITY: Record<string, boolean> = {
  week: false,
  eqPdef: false,
  eqMdef: false,
  eqPdefPct: false,
  eqMdefPct: false,
  physicalScore: false,
  magicScore: false,
  defensiveScore: false,
};

const MEDIUM_COLUMN_VISIBILITY: Record<string, boolean> = {
  playerId: false,
  week: false,
  eqPdef: false,
  eqMdef: false,
  eqPdefPct: false,
  eqMdefPct: false,
  pDmgPct: false,
  pDmgReductionPct: false,
  mDmgPct: false,
  mDmgReductionPct: false,
  dmgVsDemiHuman: false,
  dmgReductionVsDemiHuman: false,
  dmgVsMedium: false,
  dmgReductionVsMedium: false,
  pvpDmg: false,
  pvpDmgReduction: false,
  healingDone: false,
  healingTaken: false,
  physicalScore: false,
  magicScore: false,
  defensiveScore: false,
};

const MOBILE_COLUMN_VISIBILITY: Record<string, boolean> = {
  playerId: false,
  week: false,
  patk: false,
  matk: false,
  ignorePdef: false,
  ignoreMdef: false,
  eqPdef: false,
  eqMdef: false,
  eqPdefPct: false,
  eqMdefPct: false,
  rawPdef: false,
  rawMdef: false,
  pDmgPct: false,
  pDmgReductionPct: false,
  mDmgPct: false,
  mDmgReductionPct: false,
  dmgVsDemiHuman: false,
  dmgReductionVsDemiHuman: false,
  dmgVsMedium: false,
  dmgReductionVsMedium: false,
  pvpDmg: false,
  pvpDmgReduction: false,
  healingDone: false,
  healingTaken: false,
  physicalScore: false,
  magicScore: false,
  defensiveScore: false,
};

const SMALL_COLUMN_VISIBILITY: Record<string, boolean> = {
  ...MOBILE_COLUMN_VISIBILITY,
  role: false,
};

const columnVisibility = ref<Record<string, boolean>>({ ...DESKTOP_COLUMN_VISIBILITY });
const tableRef = useTemplateRef("tableRef");

// ── Progression modal ─────────────────────────────────────────────────────────
const progressionPlayer = ref<{ id: number; ign: string } | null>(null);

function openProgression(row: FlatRow) {
  closeMenu();
  progressionPlayer.value = { id: row.id, playerStringId: row.playerId, ign: row.ign };
}

// ── Row context menu ──────────────────────────────────────────────────────────
const contextRow = ref<FlatRow | null>(null);
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const actionError = ref<string | null>(null);
const confirmDeleteOpen = ref(false);
const deleteTarget = ref<FlatRow | null>(null);

function onTableContextMenu(e: MouseEvent) {
  const rowData = getRowFromMouseEvent(e);
  if (!rowData) return;
  contextRow.value = rowData;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  menuVisible.value = true;
}

function onTableRowClick(e: MouseEvent) {
  const rowData = getRowFromMouseEvent(e);
  if (!rowData) return;
  openProgression(rowData);
}

function getRowFromMouseEvent(e: MouseEvent): FlatRow | null {
  const tr = (e.target as HTMLElement).closest("tr");
  if (!tr) return null;
  const tbody = tr.closest("tbody");
  if (!tbody) return null;
  const rowIndex = Array.from(tbody.children).indexOf(tr);
  if (rowIndex < 0) return null;
  const allRows = tableRef.value?.tableApi?.getRowModel()?.rows ?? [];
  const tableRow = allRows.find((_, i) => i === rowIndex);
  if (tableRow === undefined) return null;
  return tableRow.original as FlatRow;
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

function requestDeletePlayer(row: FlatRow) {
  actionError.value = null;
  closeMenu();
  deleteTarget.value = row;
  confirmDeleteOpen.value = true;
}

function cancelDeletePlayer() {
  confirmDeleteOpen.value = false;
  deleteTarget.value = null;
}

async function confirmDeletePlayer() {
  if (!deleteTarget.value) return;
  const row = deleteTarget.value;
  await deletePlayer(row);
  confirmDeleteOpen.value = false;
  deleteTarget.value = null;
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
    <div class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search…"
        class="w-full sm:max-w-sm"
      />
      <USelect
        v-model="filterJob"
        :items="jobOptions"
        value-key="value"
        label-key="label"
        placeholder="All Jobs"
        class="w-full sm:w-44"
      />
      <USelect
        v-model="filterClassRole"
        :items="classRoleOptions"
        value-key="value"
        label-key="label"
        placeholder="All Roles"
        class="w-full sm:w-44"
      />
      <UButton
        :color="filterOutdatedOnly ? 'error' : 'neutral'"
        :variant="filterOutdatedOnly ? 'solid' : 'outline'"
        icon="i-lucide-alert-triangle"
        @click="filterOutdatedOnly = !filterOutdatedOnly"
      >
        Outdated Stats
      </UButton>
      <UDropdownMenu
        class="ml-auto"
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

    <div v-if="!loading" @click="onTableRowClick($event)" @contextmenu.prevent="auth.role !== 'Member' ? onTableContextMenu($event) : undefined">
      <UTable
        ref="tableRef"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="tableData"
        :columns="tableColumns"
        sticky
        empty="No roster members found."
        :ui="{ base: 'w-full table-auto', root: 'overflow-auto rounded-lg border border-slate-800', thead: 'sticky top-0 z-10 bg-slate-950', th: 'whitespace-normal align-bottom px-2 py-3', td: 'whitespace-normal align-top px-2 py-3', tr: 'hover:bg-white/10 transition-colors' }"
      />
    </div>

    <div v-if="loading" class="flex justify-center items-center py-20">
      <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-slate-400" />
    </div>

    <div v-if="!loading" class="flex items-center justify-between pt-2">
      <span class="text-sm text-slate-400">{{ pageLabel }}</span>
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="pageIndex === 0"
          @click="pageIndex = pageIndex - 1"
        />
        <span class="text-sm text-slate-400">Page {{ pageIndex + 1 }} of {{ totalPages }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="pageIndex + 1 >= totalPages"
          @click="pageIndex = pageIndex + 1"
        />
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="menuVisible && contextRow"
        class="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        :style="{ top: `${menuY}px`, left: `${menuX}px` }"
        @click.stop
      >
        <!-- View Progression — visible to all roles -->
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="openProgression(contextRow!)"
        >
          <UIcon name="i-lucide-trending-up" class="h-4 w-4 text-cyan-400" />
          View Progression
        </button>
        <div
          v-if="!contextRow.isFirstPlayer && (auth.role === 'Officer' || auth.role === 'Admin')"
          class="my-1 border-t border-slate-700"
        />
        <button
          v-if="!contextRow.isFirstPlayer && (auth.role === 'Officer' || auth.role === 'Admin') && contextRow.role !== 'Member'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Member')"
        >
          <UIcon name="i-lucide-user-check" class="h-4 w-4 text-green-400" />
          Set as Member
        </button>
        <button
          v-if="!contextRow.isFirstPlayer && (auth.role === 'Officer' || auth.role === 'Admin') && contextRow.role !== 'Officer' && contextRow.role !== 'Admin'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Officer')"
        >
          <UIcon name="i-lucide-shield-half" class="h-4 w-4 text-blue-400" />
          Set as Officer
        </button>
        <button
          v-if="!contextRow.isFirstPlayer && auth.role === 'Admin' && contextRow.role !== 'Admin'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Admin')"
        >
          <UIcon name="i-lucide-crown" class="h-4 w-4 text-yellow-400" />
          Set as Admin
        </button>
        <div
          v-if="!contextRow.isFirstPlayer && (auth.role === 'Officer' || auth.role === 'Admin')"
          class="my-1 border-t border-slate-700"
        />
        <button
          v-if="!contextRow.isFirstPlayer && (auth.role === 'Officer' || auth.role === 'Admin')"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
          @click="requestDeletePlayer(contextRow!)"
        >
          <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
          Delete Player
        </button>
      </div>
    </Teleport>

    <UModal v-model:open="confirmDeleteOpen">
      <template #content>
        <UCard class="border border-rose-900/40 bg-slate-950">
          <template #header>
            <span class="font-semibold text-white">Delete Player Record</span>
          </template>

          <div class="space-y-2">
            <p class="text-sm text-slate-200">
              Are you sure you want to delete this record?
            </p>
            <p class="text-sm text-rose-300">
              This action cannot be undone.
            </p>
            <p v-if="deleteTarget" class="text-xs text-slate-400">
              Player: {{ deleteTarget.ign }}
            </p>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="soft" @click="cancelDeletePlayer">Cancel</UButton>
              <UButton color="error" @click="confirmDeletePlayer">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Progression Modal -->
    <Teleport to="body">
      <PlayerProgressionModal
        v-if="progressionPlayer"
        :player-id="progressionPlayer.id"
        :player-string-id="progressionPlayer.playerStringId"
        :ign="progressionPlayer.ign"
        @close="progressionPlayer = null"
      />
    </Teleport>
  </div>
</template>
