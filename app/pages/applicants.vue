<script setup lang="ts">
import { h, resolveComponent } from "vue";
import type { TableColumn } from "@nuxt/ui";
import { upperFirst } from "scule";
import {
  type Snapshot,
  type BasePlayerFlatRow,
  rowTextClass as _rowTextClass,
  fmtPct, fmtFlat, fmtFp,
  numCols,
  usePlayerTableHeaders,
  mapSnapshotBase,
} from "~/composables/usePlayerTable";

definePageMeta({ layout: "authenticated", middleware: "auth-officer" });

const { auth } = useAuth();
const api = useApi();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();

onMounted(() => {
  setSubtitle("Applicants");
});

const UBadge = resolveComponent("UBadge");
const UIcon = resolveComponent("UIcon");

const { sortableHeader, rightHeader } = usePlayerTableHeaders(UIcon);

const ROLE_PILL: Record<string, { color: string; variant: string }> = {
  Waitlisted: { color: "warning",  variant: "soft" },
  Officer:    { color: "info",     variant: "soft" },
  Admin:      { color: "error",    variant: "soft" },
};

function rowTextClass(row: FlatRow) {
  return _rowTextClass(row.weekYear, row.weekNumber);
}

function roleCell(row: FlatRow) {
  const role = row.role;
  const pill = ROLE_PILL[role];
  if (pill) return h(UBadge, { color: pill.color, variant: pill.variant, size: "sm" }, () => role);
  return h("span", { class: `font-medium ${rowTextClass(row)}` }, role);
}

// ── Raw API types ─────────────────────────────────────────────────────────────
interface PlayerRow { id: number; ign: string; playerId: string; role: string | null; isFirstPlayer: boolean; snapshot: Snapshot | null; }

// ── Flat row for UTable ───────────────────────────────────────────────────────
type FlatRow = BasePlayerFlatRow;

// ── Data ─────────────────────────────────────────────────────────────────────
const players = ref<PlayerRow[]>([]);
const total = ref(0);
const loading = ref(true);
const errorMsg = ref<string | null>(null);

const search = ref("");
const filterJob = ref<string | null>(null);
const filterClassRole = ref<string | null>(null);
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
    if (sorting.value[0]) {
      params.sortBy = sorting.value[0].id;
      params.sortDir = sorting.value[0].desc ? "desc" : "asc";
    }
    const qs = new URLSearchParams(params).toString();
    const res = await api.get<{ players: PlayerRow[]; total: number }>(`/api/players/non-members?${qs}`);
    players.value = res.players;
    total.value = res.total;
  } catch {
    errorMsg.value = "Failed to load applicants.";
  } finally {
    loading.value = false;
  }
}

// ── Filter options from ref-data ──────────────────────────────────────────────
interface RefItem { id: number; name: string }
const allJobs = ref<RefItem[]>([]);
const allClassRoles = ref<RefItem[]>([]);

onMounted(async () => {
  if (window.innerWidth < 1024) {
    columnVisibility.value = { ...MOBILE_COLUMN_VISIBILITY };
  } else if (window.innerWidth < 1280) {
    columnVisibility.value = { ...MEDIUM_COLUMN_VISIBILITY };
  } else {
    columnVisibility.value = { ...DESKTOP_COLUMN_VISIBILITY };
  }
  const [jobs, classRoles] = await Promise.all([
    api.get<RefItem[]>("/api/ref-data/job-classes").catch(() => []),
    api.get<RefItem[]>("/api/ref-data/class-roles").catch(() => []),
  ]);
  allJobs.value = jobs;
  allClassRoles.value = classRoles;
  await fetchPlayers();
});

watch([filterJob, filterClassRole], () => {
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



const tableData = computed<FlatRow[]>(() =>
  players.value.map((p) => mapSnapshotBase(p, p.snapshot))
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

watch([search, filterJob, filterClassRole], () => { pageIndex.value = 0; });

// no fmtScore needed in applicants

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
    header: ({ column }) => sortableHeader(column, "Status"),
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

const DESKTOP_COLUMN_VISIBILITY: Record<string, boolean> = {};

const MEDIUM_COLUMN_VISIBILITY: Record<string, boolean> = {
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
};

const MOBILE_COLUMN_VISIBILITY: Record<string, boolean> = {
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
};

const columnVisibility = ref<Record<string, boolean>>({ ...DESKTOP_COLUMN_VISIBILITY });
const tableRef = useTemplateRef("tableRef");

// ── Row context menu ──────────────────────────────────────────────────────────
const contextRow = ref<FlatRow | null>(null);
const menuVisible = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const actionError = ref<string | null>(null);
const confirmDeleteOpen = ref(false);
const deleteTarget = ref<FlatRow | null>(null);

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
  const rowData = tableRow.original as FlatRow;
  if (rowData.isFirstPlayer) {
    closeMenu();
    return;
  }
  contextRow.value = rowData;
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
    await api.patch(`/api/players/${row.id}/role`, { role });
    const res = await api.get<{ players: PlayerRow[] }>(`/api/players/non-members`);
    players.value = res.players;
    const { refreshAll } = useSidebarCounters();
    refreshAll();
  } catch {
    actionError.value = "Failed to update player role. Please try again.";
  }
}

async function deletePlayer(row: FlatRow) {
  actionError.value = null;
  closeMenu();
  try {
    await api.del(`/api/players/${row.id}`);
    const res = await api.get<{ players: PlayerRow[] }>(`/api/players/non-members`);
    players.value = res.players;
  } catch {
    actionError.value = "Failed to delete player. Please try again.";
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

// ── Progression modal ─────────────────────────────────────────────────────────
const progressionPlayer = ref<{ id: number; playerStringId: string; ign: string } | null>(null);

function onTableRowClick(e: MouseEvent) {
  const tr = (e.target as HTMLElement).closest("tr");
  if (!tr) return;
  const tbody = tr.closest("tbody");
  if (!tbody) return;
  const rowIndex = Array.from(tbody.children).indexOf(tr);
  if (rowIndex < 0) return;
  const allRows = tableRef.value?.tableApi?.getRowModel()?.rows ?? [];
  const tableRow = allRows.find((_, i) => i === rowIndex);
  if (tableRow === undefined) return;
  const row = tableRow.original as FlatRow;
  if (row.weekNumber === null) return; // no snapshot, nothing to show
  progressionPlayer.value = { id: row.id, playerStringId: row.playerId, ign: row.ign };
}
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

    <div v-if="!loading" @click="onTableRowClick($event)" @contextmenu.prevent="onTableContextMenu">
      <UTable
        ref="tableRef"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :data="tableData"
        :columns="columns"
        sticky
        empty="No applicants found."
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
        <button
          v-if="!contextRow.isFirstPlayer && contextRow.role === 'Applicant'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Waitlisted')"
        >
          <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-sky-400" />
          Mark as Whitelisted
        </button>
        <button
          v-if="!contextRow.isFirstPlayer && contextRow.role === 'Waitlisted'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Applicant')"
        >
          <UIcon name="i-lucide-user" class="h-4 w-4 text-amber-400" />
          Set as Applicant
        </button>
        <button
          v-if="!contextRow.isFirstPlayer && (contextRow.role === 'Applicant' || contextRow.role === 'Waitlisted')"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          @click="changePlayerRole(contextRow!, 'Member')"
        >
          <UIcon name="i-lucide-shield-plus" class="h-4 w-4 text-green-400" />
          Set as Member
        </button>
        <div class="my-1 border-t border-slate-700" />
        <button
          v-if="!contextRow.isFirstPlayer"
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
