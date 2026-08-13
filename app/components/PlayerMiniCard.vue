<script setup lang="ts">
interface Snapshot {
  job: string;
  classRole: string;
}

interface Suggestion {
  job: string;
  jobId: number;
  classRole: string;
  classRoleId: number;
}

interface Player {
  id: number;
  ign: string;
  playerId: string;
  snapshot: Snapshot | null;
  suggestion?: Suggestion | null;
}

type StatKey = "physical" | "magic" | "defensive";
interface RankEntry { rank: number; total: number }
type RankMap = Map<number, Record<StatKey, RankEntry>>

const props = defineProps<{
  player: Player;
  actorId?: number | null;
  ranks?: RankMap;
  draggable?: boolean;
  canSuggest?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  "open-progression": [];
  "suggest": [];
  "dragstart": [event: DragEvent];
  "dragend": [];
}>();

function jobTextClass(job?: string | null) {
  if (!job) return "text-slate-500";
  const colors = ["text-violet-300", "text-sky-300", "text-amber-300", "text-rose-300", "text-emerald-300", "text-orange-300"];
  let hash = 0;
  for (let i = 0; i < job.length; i++) { hash = (hash << 5) - hash + job.charCodeAt(i); hash |= 0; }
  return colors[Math.abs(hash) % colors.length];
}

function classRoleTextClass(classRole?: string | null) {
  if (!classRole) return "text-slate-500";
  const colors = ["text-pink-300", "text-teal-300", "text-indigo-300", "text-lime-300", "text-cyan-300", "text-fuchsia-300"];
  let hash = 0;
  for (let i = 0; i < classRole.length; i++) { hash = (hash << 5) - hash + classRole.charCodeAt(i); hash |= 0; }
  return colors[Math.abs(hash) % colors.length];
}

function ordinal(n: number | undefined) {
  if (n === undefined) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

type StatKeyType = "physical" | "magic" | "defensive";

function bestRankStat(playerId: number): StatKeyType[] {
  const r = props.ranks?.get(playerId);
  if (!r) return [];
  const entries: [StatKeyType, number][] = [
    ["physical", r.physical.rank],
    ["magic", r.magic.rank],
    ["defensive", r.defensive.rank],
  ];
  const minRank = Math.min(...entries.map(e => e[1]));
  return entries.filter(e => e[1] === minRank).map(e => e[0]);
}

const isActor = computed(() => props.actorId !== null && props.actorId === props.player.id);
const snapshot = computed(() => props.player.snapshot);
const suggestion = computed(() => props.player.suggestion ?? null);

const showSuggestion = computed(() =>
  suggestion.value && (
    suggestion.value.job !== snapshot.value?.job ||
    suggestion.value.classRole !== snapshot.value?.classRole
  )
);
</script>

<template>
  <div
    class="flex items-center justify-between border bg-slate-800/60 px-3 py-2 transition-colors"
    :class="[
      isActor ? 'bg-emerald-900/40' : 'border-slate-700',
      draggable ? 'cursor-grab' : '',
    ]"
    :style="isActor ? 'border-color: #10b981;' : ''"
    :draggable="draggable"
    @dragstart="emit('dragstart', $event)"
    @dragend="emit('dragend')"
  >
    <div class="min-w-0 flex-1">
      <!-- Name + job/role line -->
      <div class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
        <button
          type="button"
          class="text-sm font-medium text-slate-100 hover:text-white hover:underline"
          title="View progression"
          @click.stop="emit('open-progression')"
        >{{ player.ign }}</button>

        <!-- Job -->
        <template v-if="!showSuggestion || suggestion!.job === snapshot?.job">
          <span :class="['text-xs', jobTextClass(snapshot?.job)]">{{ snapshot?.job ?? 'Unknown' }}</span>
        </template>
        <template v-else>
          <span :class="['text-xs line-through opacity-60', jobTextClass(snapshot?.job)]">{{ snapshot?.job ?? 'Unknown' }}</span>
        </template>

        <!-- Class role -->
        <template v-if="!showSuggestion || (suggestion!.job === snapshot?.job && suggestion!.classRole === snapshot?.classRole)">
          <span class="text-xs text-slate-500">-</span>
          <span :class="['text-xs', classRoleTextClass(snapshot?.classRole)]">{{ snapshot?.classRole ?? 'Unknown' }}</span>
        </template>
        <template v-else-if="suggestion?.job === snapshot?.job">
          <span class="text-xs text-slate-500">-</span>
          <span :class="['text-xs line-through opacity-60', classRoleTextClass(snapshot?.classRole)]">{{ snapshot?.classRole ?? 'Unknown' }}</span>
        </template>

        <!-- Suggestion arrow -->
        <template v-if="showSuggestion">
          <span class="text-xs font-semibold text-amber-400">
            → {{ suggestion!.job === snapshot?.job ? suggestion!.classRole : `${suggestion!.job} - ${suggestion!.classRole}` }}
          </span>
        </template>
      </div>

      <!-- Rank badges -->
      <div v-if="ranks" class="mt-1.5 flex flex-wrap gap-1">
        <span
          class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
          :class="bestRankStat(player.id).includes('physical') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
          title="Physical DMG rank"
        >
          <UIcon name="i-lucide-sword" class="h-2.5 w-2.5 shrink-0" />
          {{ ordinal(ranks.get(player.id)?.physical.rank) }}
        </span>
        <span
          class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
          :class="bestRankStat(player.id).includes('magic') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
          title="Magic DMG rank"
        >
          <UIcon name="i-lucide-sparkles" class="h-2.5 w-2.5 shrink-0" />
          {{ ordinal(ranks.get(player.id)?.magic.rank) }}
        </span>
        <span
          class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
          :class="bestRankStat(player.id).includes('defensive') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
          title="Defensive rank"
        >
          <UIcon name="i-lucide-shield" class="h-2.5 w-2.5 shrink-0" />
          {{ ordinal(ranks.get(player.id)?.defensive.rank) }}
        </span>
      </div>
    </div>

    <!-- Suggest button (party members only) -->
    <div v-if="canSuggest" class="flex shrink-0 gap-1">
      <UButton
        color="warning"
        variant="ghost"
        size="xs"
        icon="i-lucide-lightbulb"
        :class="suggestion ? 'opacity-100' : 'opacity-45'"
        :disabled="busy"
        title="Suggest Job Class"
        @click.stop="emit('suggest')"
      />
    </div>
  </div>
</template>
