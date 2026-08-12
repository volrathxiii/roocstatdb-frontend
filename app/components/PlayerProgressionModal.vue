<script setup lang="ts">
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;

interface Snapshot {
  weekNumber: number;
  year: number;
  job: string;
  classRole: string;
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

const props = defineProps<{
  playerId: number;
  playerStringId: string;
  ign: string;
}>();

const emit = defineEmits<{ close: [] }>();

interface ScoreSet { physical: number; magic: number; defensive: number; }
interface ScoresResponse {
  current: ScoreSet | null;
  previous: ScoreSet | null;
  classCurrent?: ScoreSet | null;
  classPrevious?: ScoreSet | null;
}
interface RankSet { rank: number; total: number; }
interface ScopedRank { guild: RankSet; classRole: RankSet; }
interface RankResponse { physical: ScopedRank | null; magic: ScopedRank | null; defensive: ScopedRank | null; }

interface SearchPlayer {
  id: number;
  ign: string;
  playerId: string;
  jobClass: string | null;
}

const snapshots = ref<Snapshot[]>([]);
const scores = ref<ScoresResponse | null>(null);
const playerRank = ref<RankResponse | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

// Compare search state
const compareQuery = ref("");
const compareResults = ref<SearchPlayer[]>([]);
const compareSearching = ref(false);
const showDropdown = ref(false);
const compareInputRef = ref<HTMLInputElement | null>(null);
const compareTarget = ref<SearchPlayer | null>(null);
const showCompareModal = ref(false);

let searchTimer: ReturnType<typeof setTimeout> | null = null;

function onCompareInput() {
  showDropdown.value = true;
  if (searchTimer) clearTimeout(searchTimer);
  if (!compareQuery.value.trim()) {
    compareResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    compareSearching.value = true;
    try {
      const res = await $fetch<{ players: SearchPlayer[] }>(
        `${backendUrl}/api/players/search?q=${encodeURIComponent(compareQuery.value.trim())}`,
      );
      compareResults.value = res.players.filter((p) => p.id !== props.playerId);
    } catch {
      compareResults.value = [];
    } finally {
      compareSearching.value = false;
    }
  }, 250);
}

function selectComparePlayer(player: SearchPlayer) {
  compareTarget.value = player;
  showDropdown.value = false;
  compareQuery.value = "";
  showCompareModal.value = true;
}

function closeDropdown() {
  setTimeout(() => { showDropdown.value = false; }, 150);
}

onMounted(async () => {
  const onKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") emit("close"); };
  document.addEventListener("keydown", onKeydown);
  nextTick(() => compareInputRef.value?.focus());
  onUnmounted(() => document.removeEventListener("keydown", onKeydown));

  try {
    [snapshots.value, scores.value, playerRank.value] = await Promise.all([
      $fetch<Snapshot[]>(`${backendUrl}/api/players/${props.playerId}/snapshots`),
      $fetch<ScoresResponse>(`${backendUrl}/api/players/${props.playerId}/scores`),
      $fetch<RankResponse>(`${backendUrl}/api/players/${props.playerId}/rank`),
    ]);
  } catch {
    error.value = "Failed to load progression data.";
  } finally {
    loading.value = false;
  }
});

const current = computed(() => snapshots.value[0] ?? null);
const previous = computed(() => snapshots.value[1] ?? null);

type StatKey = keyof Omit<Snapshot, "weekNumber" | "year" | "job" | "classRole">;

interface StatDef {
  key: StatKey;
  label: string;
  format: (v: number) => string;
}

function fmtPct(v: number)  { return `${v}%`; }
function fmtFp(v: number)   { return v.toFixed(2); }

const STAT_GROUPS: { heading: string; stats: StatDef[] }[] = [
  {
    heading: "Offense",
    stats: [
      { key: "patk",          label: "PATK",       format: String },
      { key: "matk",          label: "MATK",       format: String },
      { key: "ignorePdef",    label: "Ignore PDEF", format: String },
      { key: "ignoreMdef",    label: "Ignore MDEF", format: String },
      { key: "pDmgPct",       label: "P DMG %",    format: fmtPct },
      { key: "mDmgPct",       label: "M DMG %",    format: fmtPct },
    ],
  },
  {
    heading: "Defense",
    stats: [
      { key: "rawPdef",             label: "Raw PDEF",       format: fmtFp   },
      { key: "rawMdef",             label: "Raw MDEF",       format: fmtFp   },
      { key: "pDmgReductionPct",    label: "P DMG Red %",   format: fmtPct  },
      { key: "mDmgReductionPct",    label: "M DMG Red %",   format: fmtPct  },
      { key: "dmgReductionVsDemiHuman", label: "vs Demi-Human Red %", format: fmtPct },
      { key: "dmgReductionVsMedium",    label: "vs Medium Red %",    format: fmtPct },
      { key: "healingDone",         label: "Healing Done %", format: fmtPct },
      { key: "healingTaken",        label: "Healing Taken %", format: fmtPct },
    ],
  },
  {
    heading: "vs Targets",
    stats: [
      { key: "dmgVsDemiHuman",            label: "vs Demi-Human %",      format: fmtPct },
      { key: "dmgReductionVsDemiHuman",   label: "vs Demi-Human Red %",  format: fmtPct },
      { key: "dmgVsMedium",               label: "vs Medium %",          format: fmtPct },
      { key: "dmgReductionVsMedium",      label: "vs Medium Red %",      format: fmtPct },
    ],
  },
  {
    heading: "PVP",
    stats: [
      { key: "pvpDmg",          label: "PVP DMG",     format: String },
      { key: "pvpDmgReduction", label: "PVP Red",     format: String },
    ],
  },
];

function diff(key: StatKey): number | null {
  if (!current.value || !previous.value) return null;
  return (current.value[key] as number) - (previous.value[key] as number);
}

const jobChanged = computed(
  () => current.value && previous.value && current.value.job !== previous.value.job,
);
const classRoleChanged = computed(
  () => current.value && previous.value && current.value.classRole !== previous.value.classRole,
);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
      <!-- Header -->
      <div class="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-semibold text-white">{{ ign }}</h2>
          <p class="text-sm text-slate-400">
            Week progression
            <span v-if="current">
              — W{{ current.weekNumber }} {{ current.year }}
              <span v-if="previous"> vs W{{ previous.weekNumber }} {{ previous.year }}</span>
            </span>
          </p>
        </div>

        <!-- Compare search (inline in header) -->
        <div class="relative w-52 shrink-0">
          <UIcon name="i-lucide-users" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            v-model="compareQuery"
            type="text"
            ref="compareInputRef"
            placeholder="Compare…"
            class="w-full rounded-lg border border-slate-600 bg-slate-800 pl-8 pr-7 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            @input="onCompareInput"
            @focus="showDropdown = true"
            @blur="closeDropdown"
          />
          <UIcon
            v-if="compareSearching"
            name="i-lucide-loader-circle"
            class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-slate-400"
          />

          <!-- Dropdown -->
          <div
            v-if="showDropdown && (compareResults.length > 0 || (compareQuery.trim() && !compareSearching))"
            class="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-800 shadow-xl overflow-hidden"
          >
            <div v-if="compareResults.length === 0" class="px-4 py-3 text-sm text-slate-400">
              No players found.
            </div>
            <button
              v-for="player in compareResults"
              :key="player.id"
              type="button"
              class="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-700 transition-colors"
              @mousedown.prevent="selectComparePlayer(player)"
            >
              <span class="text-sm font-medium text-white">{{ player.ign }}</span>
            <span class="text-xs text-slate-400">{{ player.jobClass ?? '—' }}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-4 py-4 space-y-6 overflow-visible">
        <!-- Loading / Error -->
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

        <template v-else-if="current">
          <!-- No previous week notice -->
          <UAlert
            v-if="!previous"
            color="neutral"
            variant="soft"
            icon="i-lucide-info"
            title="No previous week data available to compare."
          />

          <!-- Scores -->
          <div v-if="scores?.current" class="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Class Scores</p>
            <div class="flex flex-nowrap gap-2 sm:gap-4">
              <div class="w-1/3 min-w-0 flex flex-col items-center gap-1">
                <UIcon name="i-lucide-sword" class="h-5 w-5 text-orange-400" />
                <p class="text-xs text-slate-400">Physical</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ (scores.classCurrent?.physical ?? scores.current.physical).toFixed(1) }}<span class="text-xs sm:text-sm text-slate-400">%</span></p>
                <p v-if="playerRank?.physical" class="text-xs text-slate-400 font-medium">
                  Class Rank #{{ playerRank.physical.classRole.rank }} / {{ playerRank.physical.classRole.total }}
                </p>
                <p v-if="playerRank?.physical" class="text-xs text-slate-500">
                  Guild Rank #{{ playerRank.physical.guild.rank }} / {{ playerRank.physical.guild.total }}
                </p>
              </div>
              <div class="w-1/3 min-w-0 flex flex-col items-center gap-1">
                <UIcon name="i-lucide-wand" class="h-5 w-5 text-purple-400" />
                <p class="text-xs text-slate-400">Magic</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ (scores.classCurrent?.magic ?? scores.current.magic).toFixed(1) }}<span class="text-xs sm:text-sm text-slate-400">%</span></p>
                <p v-if="playerRank?.magic" class="text-xs text-slate-400 font-medium">
                  Class Rank #{{ playerRank.magic.classRole.rank }} / {{ playerRank.magic.classRole.total }}
                </p>
                <p v-if="playerRank?.magic" class="text-xs text-slate-500">
                  Guild Rank #{{ playerRank.magic.guild.rank }} / {{ playerRank.magic.guild.total }}
                </p>
              </div>
              <div class="w-1/3 min-w-0 flex flex-col items-center gap-1">
                <UIcon name="i-lucide-shield" class="h-5 w-5 text-cyan-400" />
                <p class="text-xs text-slate-400">Defense</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ (scores.classCurrent?.defensive ?? scores.current.defensive).toFixed(1) }}<span class="text-xs sm:text-sm text-slate-400">%</span></p>
                <p v-if="playerRank?.defensive" class="text-xs text-slate-400 font-medium">
                  Class Rank #{{ playerRank.defensive.classRole.rank }} / {{ playerRank.defensive.classRole.total }}
                </p>
                <p v-if="playerRank?.defensive" class="text-xs text-slate-500">
                  Guild Rank #{{ playerRank.defensive.guild.rank }} / {{ playerRank.defensive.guild.total }}
                </p>
              </div>
            </div>
          </div>

          <!-- Job / Class Role -->
          <div class="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-2">
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500">Class</p>
            <div class="flex flex-wrap gap-4">
              <div>
                <p class="text-xs text-slate-500 mb-0.5">Job</p>
                <p class="text-white font-medium">
                  {{ current.job }}
                  <span v-if="jobChanged" class="text-red-400 text-sm ml-1">
                    (was {{ previous!.job }})
                  </span>
                </p>
              </div>
              <div>
                <p class="text-xs text-slate-500 mb-0.5">Role</p>
                <p class="text-white font-medium">
                  {{ current.classRole }}
                  <span v-if="classRoleChanged" class="text-red-400 text-sm ml-1">
                    (was {{ previous!.classRole }})
                  </span>
                </p>
              </div>
            </div>
          </div>

          <!-- Stat groups -->
          <div
            v-for="group in STAT_GROUPS"
            :key="group.heading"
            class="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-1"
          >
            <p class="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
              {{ group.heading }}
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              <div
                v-for="stat in group.stats"
                :key="stat.key"
                class="flex items-center justify-between gap-2"
              >
                <span class="text-sm text-slate-400 shrink-0">{{ stat.label }}</span>
                <span class="flex items-center gap-1 text-sm font-medium">
                  <span class="text-white">{{ stat.format(current[stat.key] as number) }}</span>

                  <!-- Delta indicator -->
                  <template v-if="diff(stat.key) !== null && diff(stat.key) !== 0">
                    <span
                      :class="diff(stat.key)! > 0 ? 'text-green-400' : 'text-red-400'"
                      class="flex items-center gap-0.5 text-xs"
                    >
                      <UIcon
                        :name="diff(stat.key)! > 0 ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                        class="h-3 w-3"
                      />
                      {{ stat.format(Math.abs(diff(stat.key)!)) }}
                    </span>
                  </template>
                </span>
              </div>
            </div>
          </div>
        </template>

        <UAlert
          v-else
          color="neutral"
          variant="soft"
          icon="i-lucide-info"
          title="No snapshot data available for this player."
        />
      </div>
    </div>
  </div>

  <!-- Compare modal -->
  <PlayerCompareModal
    v-if="showCompareModal && compareTarget"
    :player-id-a="playerStringId"
    :player-id-b="compareTarget.playerId"
    :ign-a="ign"
    :ign-b="compareTarget.ign"
    @close="showCompareModal = false"
  />
</template>
