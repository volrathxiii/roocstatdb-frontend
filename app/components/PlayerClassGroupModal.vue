<script setup lang="ts">
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;

interface PlayerRow {
  id: number;
  ign: string;
  playerId: string;
  weekNumber: number;
  year: number;
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

interface ClassGroupResponse {
  job: string | null;
  classRole: string | null;
  players: PlayerRow[];
}

const props = defineProps<{
  jobId: number;
  classRoleId: number;
  label: string;
  activePlayerId: number;
  includePlayerId: string;
}>();

const emit = defineEmits<{ close: [] }>();

const data = ref<ClassGroupResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  const onKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") emit("close"); };
  document.addEventListener("keydown", onKeydown);
  onUnmounted(() => document.removeEventListener("keydown", onKeydown));

  try {
    data.value = await $fetch<ClassGroupResponse>(
      `${backendUrl}/api/stat-snapshots/class-group?jobId=${props.jobId}&classRoleId=${props.classRoleId}&includePlayerId=${encodeURIComponent(props.includePlayerId)}`,
    );
  } catch {
    error.value = "Failed to load class group data.";
  } finally {
    loading.value = false;
  }
});

// Active player first, rest in original order
const sortedPlayers = computed<PlayerRow[]>(() => {
  if (!data.value) return [];
  const active = data.value.players.find((p) => p.id === props.activePlayerId);
  const rest = data.value.players.filter((p) => p.id !== props.activePlayerId);
  return active ? [active, ...rest] : rest;
});

type StatKey =
  | "patk" | "matk" | "ignorePdef" | "ignoreMdef"
  | "eqPdef" | "eqMdef" | "eqPdefPct" | "eqMdefPct"
  | "rawPdef" | "rawMdef"
  | "pDmgPct" | "pDmgReductionPct" | "mDmgPct" | "mDmgReductionPct"
  | "dmgVsDemiHuman" | "dmgReductionVsDemiHuman"
  | "dmgVsMedium" | "dmgReductionVsMedium"
  | "pvpDmg" | "pvpDmgReduction"
  | "healingDone" | "healingTaken";

interface StatDef { key: StatKey; label: string; format: (v: number) => string; }

function fmtPct(v: number) { return `${v}%`; }
function fmtFp(v: number) { return v.toFixed(2); }

const STAT_GROUPS: { heading: string; stats: StatDef[] }[] = [
  {
    heading: "Offense",
    stats: [
      { key: "patk",       label: "PATK",        format: String },
      { key: "matk",       label: "MATK",        format: String },
      { key: "ignorePdef", label: "Ignore PDEF", format: String },
      { key: "ignoreMdef", label: "Ignore MDEF", format: String },
      { key: "pDmgPct",    label: "P DMG %",     format: fmtPct },
      { key: "mDmgPct",    label: "M DMG %",     format: fmtPct },
    ],
  },
  {
    heading: "Defense",
    stats: [
      { key: "rawPdef",                 label: "Raw PDEF",            format: fmtFp  },
      { key: "rawMdef",                 label: "Raw MDEF",            format: fmtFp  },
      { key: "pDmgReductionPct",        label: "P DMG Red %",         format: fmtPct },
      { key: "mDmgReductionPct",        label: "M DMG Red %",         format: fmtPct },
      { key: "dmgReductionVsDemiHuman", label: "vs Demi-Human Red %", format: fmtPct },
      { key: "dmgReductionVsMedium",    label: "vs Medium Red %",     format: fmtPct },
      { key: "healingDone",             label: "Healing Done %",      format: fmtPct },
      { key: "healingTaken",            label: "Healing Taken %",     format: fmtPct },
    ],
  },
  {
    heading: "vs Targets",
    stats: [
      { key: "dmgVsDemiHuman", label: "vs Demi-Human %", format: fmtPct },
      { key: "dmgVsMedium",    label: "vs Medium %",     format: fmtPct },
    ],
  },
  {
    heading: "PVP",
    stats: [
      { key: "pvpDmg",          label: "PVP DMG", format: String },
      { key: "pvpDmgReduction", label: "PVP Red", format: String },
    ],
  },
];

function isHighest(key: StatKey, player: PlayerRow): boolean {
  if (!data.value || data.value.players.length < 2) return false;
  const val = player[key] as number;
  return (
    data.value.players.every((p) => (p[key] as number) <= val) &&
    data.value.players.some((p) => p !== player && (p[key] as number) < val)
  );
}
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-700 px-4 py-3 shrink-0">
        <div>
          <h2 class="text-xl font-semibold text-white">{{ label }}</h2>
          <p class="text-sm text-slate-400">Class group comparison — latest snapshots</p>
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
      <div class="overflow-auto flex-1">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <UIcon name="i-lucide-loader-circle" class="h-7 w-7 animate-spin text-slate-400" />
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="error"
          class="m-4"
        />

        <UAlert
          v-else-if="!data || data.players.length === 0"
          color="neutral"
          variant="soft"
          icon="i-lucide-info"
          title="No players with snapshots found for this class group."
          class="m-4"
        />

        <template v-else>
          <table
            class="text-sm border-collapse w-full"
            :style="sortedPlayers.length > 5 ? 'min-width: max-content' : ''"
          >
            <!-- Player name headers (sticky top) -->
            <thead class="sticky top-0 z-20">
              <tr class="border-b border-slate-700 bg-slate-900">
                <!-- Stat label column header -->
                <th class="sticky left-0 z-30 bg-slate-900 px-4 py-3 text-left text-xs text-slate-500 font-medium min-w-[160px] w-[160px] border-r border-slate-700/60" />
                <!-- One column per player -->
                <th
                  v-for="player in sortedPlayers"
                  :key="player.id"
                  class="px-4 py-3 text-center min-w-[130px]"
                  :class="player.id === activePlayerId
                    ? 'sticky left-[160px] z-30 bg-[#1e2d4a] border-r border-indigo-500/40'
                    : 'bg-slate-900'"
                >
                  <p
                    class="font-semibold truncate"
                    :class="player.id === activePlayerId ? 'text-indigo-300' : 'text-white'"
                  >
                    {{ player.ign }}
                  </p>
                  <p class="text-[11px] text-slate-500 mt-0.5">W{{ player.weekNumber }} {{ player.year }}</p>
                </th>
              </tr>
            </thead>

            <tbody>
              <template v-for="group in STAT_GROUPS" :key="group.heading">
                <!-- Group heading row -->
                <tr class="bg-slate-800/50 border-y border-slate-700/60">
                  <td
                    class="sticky left-0 z-10 bg-slate-800/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 border-r border-slate-700/60"
                    :colspan="1"
                  >
                    {{ group.heading }}
                  </td>
                  <td
                    v-for="player in sortedPlayers"
                    :key="player.id"
                    class="py-1.5"
                    :class="player.id === activePlayerId
                      ? 'sticky left-[160px] z-10 bg-[#1e2d4a] border-r border-indigo-500/40'
                      : ''"
                  />
                </tr>

                <!-- Stat rows -->
                <tr
                  v-for="stat in group.stats"
                  :key="stat.key"
                  class="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                >
                  <!-- Stat label (sticky left) -->
                  <td class="sticky left-0 z-10 bg-slate-900 px-4 py-2 text-xs text-slate-400 border-r border-slate-700/60 whitespace-nowrap">
                    {{ stat.label }}
                  </td>

                  <!-- Value per player -->
                  <td
                    v-for="player in sortedPlayers"
                    :key="player.id"
                    class="px-4 py-2 text-center"
                    :class="player.id === activePlayerId
                      ? 'sticky left-[160px] z-10 bg-[#1e2d4a] border-r border-indigo-500/40'
                      : ''"
                  >
                    <span class="inline-flex items-center justify-center gap-1">
                      <UIcon
                        v-if="isHighest(stat.key, player)"
                        name="i-lucide-arrow-up"
                        class="h-3 w-3 text-green-400 shrink-0"
                      />
                      <span :class="isHighest(stat.key, player) ? 'text-green-400 font-medium' : 'text-white'">
                        {{ stat.format(player[stat.key] as number) }}
                      </span>
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>
