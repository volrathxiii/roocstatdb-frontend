<script setup lang="ts">
interface Snapshot {
  weekNumber: number;
  year: number;
  job: string;
  classRole: string;
}

interface PartyMember {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  position: number;
  snapshot: Snapshot | null;
}

type StatKey = "physical" | "magic" | "defensive";
interface RankEntry { rank: number; total: number }
type RankMap = Map<number, Record<StatKey, RankEntry>>;

interface Party {
  id: number;
  name: string;
  category: "Main" | "Sub";
  notes: string | null;
  groupId: number | null;
  position: number;
  members: PartyMember[];
}

const props = defineProps<{
  party: Party;
  canEdit: boolean;
  busy: boolean;
  actorId: number | null;
  editingNamePartyId: number | null;
  editingNameValue: string;
  editingCategoryPartyId: number | null;
  editingNotePartyId: number | null;
  editingNoteValue: string;
  isDraggingMember: boolean;
  hoveredDropZone: string | null;
  partyCategoryOptions: { label: string; value: string }[];
  classRanksByPlayerId?: RankMap;
}>();

const emit = defineEmits<{
  "update:editingNameValue": [v: string];
  "update:editingNoteValue": [v: string];
  "start-edit-name": [party: Party];
  "commit-edit-name": [party: Party];
  "cancel-edit-name": [];
  "start-edit-category": [party: Party];
  "commit-edit-category": [party: Party, v: "Main" | "Sub"];
  "cancel-edit-category": [];
  "start-edit-note": [party: Party];
  "commit-edit-note": [party: Party];
  "delete-party": [party: Party];
  "remove-from-party": [party: Party, memberId: number];
  "drag-over-party": [event: DragEvent];
  "drop-to-party": [event: DragEvent, party: Party];
  "drag-over-member-zone": [event: DragEvent];
  "drag-leave-member-zone": [event: DragEvent];
  "drag-start-member": [event: DragEvent, party: Party, member: PartyMember];
  "drag-end-member": [];
  "drag-start-party": [event: DragEvent, party: Party];
  "drag-end-party": [];
  "drop-member-reorder": [event: DragEvent, party: Party, index: number];
  "update:hoveredDropZone": [v: string | null];
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

function bestRankStat(playerId: number): StatKey[] {
  const ranks = props.classRanksByPlayerId?.get(playerId);
  if (!ranks) return [];
  const entries: Array<[StatKey, number]> = [
    ["physical", ranks.physical.rank],
    ["magic", ranks.magic.rank],
    ["defensive", ranks.defensive.rank],
  ];
  const minRank = Math.min(...entries.map((e) => e[1]));
  return entries.filter((e) => e[1] === minRank).map((e) => e[0]);
}

function dropZoneStyle(key: string) {
  const active = props.hoveredDropZone === key;
  return {
    height: props.isDraggingMember ? "10px" : "0px",
    transition: "height 0.15s ease",
    backgroundColor: active ? "rgba(6,182,212,0.35)" : "transparent",
    borderTop: active ? "1px solid rgba(6,182,212,0.7)" : "none",
    borderBottom: active ? "1px solid rgba(6,182,212,0.7)" : "none",
  };
}

function onPartyDragStart(event: DragEvent) {
  if (!props.canEdit) return;
  console.log("[PartyDrag][Card] dragstart", {
    partyId: props.party.id,
    canEdit: props.canEdit,
    hasDataTransfer: Boolean(event.dataTransfer),
    eventType: event.type,
  });
  if (event.dataTransfer) {
    const payload = String(props.party.id);
    event.dataTransfer.setData("text/party-id", payload);
    event.dataTransfer.setData("text/plain", `party:${payload}`);
    event.dataTransfer.setData("text", `party:${payload}`);
    event.dataTransfer.effectAllowed = "move";
    console.log("[PartyDrag][Card] payload set", {
      partyId: props.party.id,
      custom: event.dataTransfer.getData("text/party-id"),
      plain: event.dataTransfer.getData("text/plain"),
      text: event.dataTransfer.getData("text"),
    });
  } else {
    console.log("[PartyDrag][Card] no dataTransfer available");
  }
  event.stopPropagation();
  emit("drag-start-party", event, props.party);
}

function onPartyDragEnd() {
  console.log("[PartyDrag][Card] dragend", { partyId: props.party.id });
  emit("drag-end-party");
}
</script>

<template>
  <article
    class="w-full max-w-[20rem] overflow-hidden rounded-xl border border-cyan-900/30 bg-slate-950/70 pt-3"
    @dragover="emit('drag-over-party', $event)"
    @drop="emit('drop-to-party', $event, party)"
  >
    <!-- Header -->
    <div class="mb-2 flex items-center gap-2 px-3">
      <template v-if="canEdit && editingNamePartyId === party.id">
        <UInput
          :model-value="editingNameValue"
          class="flex-1 text-sm"
          autofocus
          @update:model-value="emit('update:editingNameValue', $event as string)"
          @keyup.enter="emit('commit-edit-name', party)"
          @keyup.escape="emit('cancel-edit-name')"
          @blur="emit('commit-edit-name', party)"
        />
        <UButton color="primary" variant="ghost" size="xs" icon="i-lucide-check" square @click="emit('commit-edit-name', party)" />
      </template>
      <template v-else>
        <p
          class="flex-1 truncate text-sm font-semibold"
          :class="canEdit ? 'cursor-pointer text-slate-100 hover:text-white' : 'text-slate-100'"
          :title="canEdit ? 'Click to rename' : undefined"
          @click="canEdit && emit('start-edit-name', party)"
        >{{ party.name }}</p>
      </template>

      <template v-if="canEdit && editingCategoryPartyId === party.id">
        <USelect
          :model-value="party.category"
          :items="partyCategoryOptions"
          value-key="value"
          label-key="label"
          class="w-24"
          autofocus
          @update:model-value="(v: string) => emit('commit-edit-category', party, v as 'Main' | 'Sub')"
          @blur="emit('cancel-edit-category')"
        />
      </template>
      <template v-else>
        <span
          class="shrink-0 text-xs font-semibold"
          :class="[canEdit ? 'cursor-pointer' : '', party.category === 'Main' ? 'text-amber-300' : 'text-slate-400']"
          :title="canEdit ? 'Click to change category' : undefined"
          @click="canEdit && emit('start-edit-category', party)"
        >{{ party.category }}</span>
      </template>

      <div
        v-if="canEdit"
        data-party-drag-handle
        class="flex cursor-grab select-none items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        title="Drag party to group"
        :draggable="true"
        style="-webkit-user-drag: element"
        @dragstart.capture="onPartyDragStart"
        @dragend.capture="onPartyDragEnd"
      >
        <UIcon name="i-lucide-grip-vertical" class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Group</span>
      </div>

      <UButton v-if="canEdit" color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" square :disabled="busy" @click="emit('delete-party', party)" />
    </div>

    <!-- Members drop zone -->
    <div
      class="min-h-36 border-t border-slate-800 bg-slate-900/50"
      @dragover="emit('drag-over-member-zone', $event)"
      @dragleave="emit('drag-leave-member-zone', $event)"
      @drop="emit('drop-member-reorder', $event, party, party.members.length)"
    >
      <template v-if="party.members.length > 0">
        <div v-for="(member, idx) in party.members" :key="`${party.id}-${member.id}`" class="flex flex-col">
          <!-- Drop zone before member -->
          <div
            v-if="canEdit"
            class="pointer-events-auto"
            :style="dropZoneStyle(`${party.id}-${idx}`)"
            @dragover="(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; emit('update:hoveredDropZone', `${party.id}-${idx}`); }"
            @dragleave="emit('update:hoveredDropZone', null)"
            @drop="(e) => { e.preventDefault(); emit('drop-member-reorder', e, party, idx); }"
          />
          <!-- Member row -->
          <div
            data-party-member-row
            class="flex cursor-grab items-center justify-between border bg-slate-800/60 px-3 py-2 transition-colors"
            :class="member.id === actorId ? 'bg-emerald-900/40' : 'border-slate-700'"
            :style="member.id === actorId ? 'border-color: #10b981;' : ''"
            :draggable="canEdit"
            @dragstart="emit('drag-start-member', $event, party, member)"
            @dragend="emit('drag-end-member')"
            @dragover="emit('drag-over-member-zone', $event)"
            @dragleave="emit('drag-leave-member-zone', $event)"
            @drop="emit('drop-member-reorder', $event, party, idx)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <p class="text-sm font-medium text-slate-100">{{ member.ign }}</p>
                <span :class="['text-xs', jobTextClass(member.snapshot?.job)]">{{ member.snapshot?.job ?? "Unknown" }}</span>
                <span class="text-xs text-slate-500">·</span>
                <span :class="['text-xs', classRoleTextClass(member.snapshot?.classRole)]">{{ member.snapshot?.classRole ?? "Unknown" }}</span>
              </div>
              <div v-if="classRanksByPlayerId" class="mt-1.5 flex flex-wrap gap-1">
                <span
                  class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
                  :class="bestRankStat(member.id).includes('physical') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                  title="Physical DMG rank"
                >
                  <UIcon name="i-lucide-sword" class="h-2.5 w-2.5 shrink-0" />
                  {{ ordinal(classRanksByPlayerId?.get(member.id)?.physical.rank) }}
                </span>
                <span
                  class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
                  :class="bestRankStat(member.id).includes('magic') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                  title="Magic DMG rank"
                >
                  <UIcon name="i-lucide-sparkles" class="h-2.5 w-2.5 shrink-0" />
                  {{ ordinal(classRanksByPlayerId?.get(member.id)?.magic.rank) }}
                </span>
                <span
                  class="flex items-center gap-0.5 rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
                  :class="bestRankStat(member.id).includes('defensive') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                  title="Defensive rank"
                >
                  <UIcon name="i-lucide-shield" class="h-2.5 w-2.5 shrink-0" />
                  {{ ordinal(classRanksByPlayerId?.get(member.id)?.defensive.rank) }}
                </span>
              </div>
            </div>
            <UButton v-if="canEdit" color="error" variant="ghost" size="xs" icon="i-lucide-x" :disabled="busy" @click="emit('remove-from-party', party, member.id)" />
          </div>
        </div>
        <!-- Drop zone after last member -->
        <div
          v-if="canEdit"
          class="pointer-events-auto"
          :style="dropZoneStyle(`${party.id}-end`)"
          @dragover="(e) => { e.preventDefault(); e.dataTransfer!.dropEffect = 'move'; emit('update:hoveredDropZone', `${party.id}-end`); }"
          @dragleave="emit('update:hoveredDropZone', null)"
          @drop="(e) => { e.preventDefault(); emit('drop-member-reorder', e, party, party.members.length); }"
        />
      </template>
      <p v-if="party.members.length === 0" class="py-6 text-center text-xs text-slate-500">Drag and drop players here</p>
    </div>

    <!-- Notes footer -->
    <div class="border-t border-slate-800 bg-slate-950/60">
      <template v-if="canEdit && editingNotePartyId === party.id">
        <div class="flex items-start gap-2 px-3 py-2">
          <UTextarea
            :model-value="editingNoteValue"
            placeholder="Add a note…"
            :rows="2"
            class="flex-1 text-xs"
            autofocus
            @update:model-value="emit('update:editingNoteValue', $event as string)"
          />
          <UButton color="primary" variant="ghost" size="xs" icon="i-lucide-check" square @click="emit('commit-edit-note', party)" />
        </div>
      </template>
      <template v-else>
        <div
          v-if="party.notes"
          class="flex items-start gap-1.5 px-3 py-2"
          :class="canEdit ? 'cursor-pointer hover:bg-slate-800/40' : ''"
          @click="canEdit ? emit('start-edit-note', party) : undefined"
        >
          <UIcon name="i-lucide-notebook" class="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
          <p class="text-[11px] leading-snug text-slate-300">{{ party.notes }}</p>
        </div>
        <button
          v-else-if="canEdit"
          type="button"
          class="flex w-full items-center gap-1 px-3 py-2 text-[11px] text-slate-600 hover:text-slate-400"
          @click="emit('start-edit-note', party)"
        >
          <UIcon name="i-lucide-notebook" class="h-3 w-3" />
          Add note
        </button>
        <div v-else class="px-3 py-2 text-[11px] text-slate-700 italic">No notes</div>
      </template>
    </div>
  </article>
</template>
