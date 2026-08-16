<script setup lang="ts">
const api = useApi();
const config = useRuntimeConfig();

interface Snapshot {
  weekNumber: number;
  year: number;
  job: { name: string };
  classRole: { name: string };
  hp: number;
  patk: number;
  matk: number;
  ignorePdef: number;
  ignoreMdef: number;
  eqPdef: number;
  eqMdef: number;
  eqPdefPct: number;
  eqMdefPct: number;
  rawPdef: number;
  rawMdef: number;
  pDmgPct: number;
  pDmgReductionPct: number;
  mDmgPct: number;
  mDmgReductionPct: number;
  dmgVsDemiHuman: number;
  dmgReductionVsDemiHuman: number;
  dmgVsMedium: number;
  dmgReductionVsMedium: number;
  pvpDmg: number;
  pvpDmgReduction: number;
  healingDone: number;
  healingTaken: number;
}

interface PlayerSlot {
  player: { id: number; ign: string; playerId: string };
  snapshot: Snapshot | null;
}

interface CompareResponse {
  playerA: PlayerSlot;
  playerB: PlayerSlot;
}

const props = defineProps<{
  playerIdA: string;
  playerIdB: string;
  ignA: string;
  ignB: string;
}>();

const emit = defineEmits<{ close: [] }>();

const data = ref<CompareResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  const onKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") emit("close"); };
  document.addEventListener("keydown", onKeydown);
  onUnmounted(() => document.removeEventListener("keydown", onKeydown));

  try {
    data.value = await api.get<CompareResponse>(
      `/api/stat-snapshots/compare?playerIdA=${encodeURIComponent(props.playerIdA)}&playerIdB=${encodeURIComponent(props.playerIdB)}`,
    );
  } catch {
    error.value = "Failed to load comparison data.";
  } finally {
    loading.value = false;
  }
});

type StatKey =
  | "hp" | "patk" | "matk" | "ignorePdef" | "ignoreMdef"
  | "eqPdef" | "eqMdef" | "eqPdefPct" | "eqMdefPct"
  | "rawPdef" | "rawMdef"
  | "pDmgPct" | "pDmgReductionPct" | "mDmgPct" | "mDmgReductionPct"
  | "dmgVsDemiHuman" | "dmgReductionVsDemiHuman"
  | "dmgVsMedium" | "dmgReductionVsMedium"
  | "pvpDmg" | "pvpDmgReduction"
  | "healingDone" | "healingTaken";

interface StatDef {
  key: StatKey;
  label: string;
  format: (v: number) => string;
}

function fmtPct(v: number) { return `${v}%`; }
function fmtFp(v: number)  { return v.toFixed(2); }

const STAT_GROUPS: { heading: string; stats: StatDef[] }[] = [
  {
    heading: "Offense",
    stats: [
      { key: "patk",           label: "PATK",                format: String },
      { key: "matk",           label: "MATK",                format: String },
      { key: "ignorePdef",     label: "Ignore PDEF",         format: String },
      { key: "ignoreMdef",     label: "Ignore MDEF",         format: String },
      { key: "dmgVsDemiHuman", label: "DMG vs Demi-human %", format: fmtPct },
      { key: "dmgVsMedium",    label: "DMG vs Medium %",     format: fmtPct },
      { key: "pDmgPct",        label: "Physical DMG %",      format: fmtPct },
      { key: "mDmgPct",        label: "Magic DMG %",         format: fmtPct },
      { key: "pvpDmg",         label: "PVP DMG",             format: String },
    ],
  },
  {
    heading: "Defense",
    stats: [
      { key: "hp",                      label: "HP",                             format: String },
      { key: "rawPdef",                 label: "Raw PDEF",                       format: fmtFp  },
      { key: "rawMdef",                 label: "Raw MDEF",                       format: fmtFp  },
      { key: "pDmgReductionPct",        label: "Physical DMG Reduction %",       format: fmtPct },
      { key: "mDmgReductionPct",        label: "Magic DMG Reduction %",          format: fmtPct },
      { key: "dmgReductionVsDemiHuman", label: "DMG Reduction vs Demi-human %",  format: fmtPct },
      { key: "dmgReductionVsMedium",    label: "DMG Reduction vs Medium %",      format: fmtPct },
      { key: "healingDone",             label: "Healing Done %",                  format: fmtPct },
      { key: "healingTaken",            label: "Healing Taken %",                 format: fmtPct },
      { key: "pvpDmgReduction",         label: "PVP Reduction",                   format: String },
    ],
  },
];

function getVal(snapshot: Snapshot | null, key: StatKey): number | null {
  if (!snapshot) return null;
  return snapshot[key] as number;
}

function isHigher(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  return a > b;
}
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
      <!-- Header -->
      <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div>
          <h2 class="text-xl font-semibold text-white">Player Comparison</h2>
          <p class="text-sm text-slate-400">Week progression comparison</p>
        </div>
        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-4 py-4 space-y-4">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="h-7 w-7 animate-spin text-slate-400" />
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="error"
        />

        <template v-else-if="data">
          <!-- No stats warning -->
          <UAlert
            v-if="!data.playerA.snapshot || !data.playerB.snapshot"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="!data.playerA.snapshot && !data.playerB.snapshot
              ? 'Neither player has stat data yet.'
              : !data.playerA.snapshot
                ? `${ignA} has no stat data yet.`
                : `${ignB} has no stat data yet.`"
          />

          <template v-else>
            <!-- Column headers -->
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 pb-1">
              <div class="text-center">
                <p class="text-sm font-semibold text-white truncate">{{ ignA }}</p>
                <p class="text-xs text-slate-400">
                  {{ data.playerA.snapshot.job.name }} · {{ data.playerA.snapshot.classRole.name }}
                </p>
                <p class="text-xs text-slate-500">W{{ data.playerA.snapshot.weekNumber }} {{ data.playerA.snapshot.year }}</p>
              </div>
              <div class="w-px" />
              <div class="text-center">
                <p class="text-sm font-semibold text-white truncate">{{ ignB }}</p>
                <p class="text-xs text-slate-400">
                  {{ data.playerB.snapshot.job.name }} · {{ data.playerB.snapshot.classRole.name }}
                </p>
                <p class="text-xs text-slate-500">W{{ data.playerB.snapshot.weekNumber }} {{ data.playerB.snapshot.year }}</p>
              </div>
            </div>

            <!-- Stat groups -->
            <div
              v-for="group in STAT_GROUPS"
              :key="group.heading"
              class="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden"
            >
              <div class="px-4 py-2 border-b border-slate-700/60">
                <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">{{ group.heading }}</p>
              </div>
              <div class="divide-y divide-slate-700/40">
                <div
                  v-for="stat in group.stats"
                  :key="stat.key"
                  class="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2 gap-2"
                >
                  <!-- Player A value -->
                  <div class="flex items-center justify-start gap-1.5">
                    <span
                      class="text-sm font-medium"
                      :class="isHigher(getVal(data.playerA.snapshot, stat.key), getVal(data.playerB.snapshot, stat.key))
                        ? 'text-green-400'
                        : 'text-white'"
                    >
                      {{ getVal(data.playerA.snapshot, stat.key) !== null
                        ? stat.format(getVal(data.playerA.snapshot, stat.key)!)
                        : '—' }}
                    </span>
                    <UIcon
                      v-if="isHigher(getVal(data.playerA.snapshot, stat.key), getVal(data.playerB.snapshot, stat.key))"
                      name="i-lucide-arrow-up"
                      class="h-3.5 w-3.5 text-green-400 shrink-0"
                    />
                  </div>

                  <!-- Stat label (center) -->
                  <div class="px-3 text-center min-w-[110px]">
                    <span class="text-xs text-slate-400">{{ stat.label }}</span>
                  </div>

                  <!-- Player B value -->
                  <div class="flex items-center justify-end gap-1.5">
                    <UIcon
                      v-if="isHigher(getVal(data.playerB.snapshot, stat.key), getVal(data.playerA.snapshot, stat.key))"
                      name="i-lucide-arrow-up"
                      class="h-3.5 w-3.5 text-green-400 shrink-0"
                    />
                    <span
                      class="text-sm font-medium"
                      :class="isHigher(getVal(data.playerB.snapshot, stat.key), getVal(data.playerA.snapshot, stat.key))
                        ? 'text-green-400'
                        : 'text-white'"
                    >
                      {{ getVal(data.playerB.snapshot, stat.key) !== null
                        ? stat.format(getVal(data.playerB.snapshot, stat.key)!)
                        : '—' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
