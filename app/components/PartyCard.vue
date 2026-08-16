<script setup lang="ts">
interface Snapshot {
  weekNumber: number;
  year: number;
  job: string;
  classRole: string;
}

interface Suggestion {
  job: string;
  jobId: number;
  classRole: string;
  classRoleId: number;
}

interface PartyMember {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  position: number;
  snapshot: Snapshot | null;
  suggestion: Suggestion | null;
}

interface MissingCapability {
  capability: string;
  recommendedClasses: Array<{ job: string; classRole: string }>;
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
  missingCapabilities?: MissingCapability[];
}

const props = defineProps<{
  party: Party;
  canEdit: boolean;
  busy: boolean;
  actorId: number | null;
  isDraggingMember: boolean;
  hoveredDropZone: string | null;
  partyCategoryOptions: { label: string; value: string }[];
  classRanksByPlayerId?: RankMap;
}>();

const emit = defineEmits<{
  "rename": [party: Party, name: string];
  "change-category": [party: Party, category: "Main" | "Sub"];
  "change-note": [party: Party, note: string | null];
  "delete-party": [party: Party];
  "remove-from-party": [party: Party, memberId: number];
  "suggest-class": [party: Party, member: PartyMember];
  "suggest-class-recommendation": [party: Party, job: string, classRole: string];
  "open-progression": [member: PartyMember];
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

// ── Local edit state ──────────────────────────────────────────────────────────
const editingName = ref(false);
const editingNameValue = ref('');

const editingCategory = ref(false);

const editingNote = ref(false);
const editingNoteValue = ref('');

function startEditName() {
  if (!props.canEdit) return;
  editingNameValue.value = props.party.name;
  editingName.value = true;
}

function commitEditName() {
  editingName.value = false;
  const trimmed = editingNameValue.value.trim();
  if (trimmed && trimmed !== props.party.name) {
    emit('rename', props.party, trimmed);
  }
}

function startEditNote() {
  if (!props.canEdit) return;
  editingNoteValue.value = props.party.notes ?? '';
  editingNote.value = true;
}

function commitEditNote() {
  editingNote.value = false;
  const next = editingNoteValue.value.trim() || null;
  if (next !== props.party.notes) {
    emit('change-note', props.party, next);
  }
}

function commitEditCategory(v: string) {
  editingCategory.value = false;
  const cat = v as "Main" | "Sub";
  if (cat !== props.party.category) {
    emit('change-category', props.party, cat);
  }
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
  if (event.dataTransfer) {
    const payload = String(props.party.id);
    event.dataTransfer.setData("text/party-id", payload);
    event.dataTransfer.setData("text/plain", `party:${payload}`);
    event.dataTransfer.setData("text", `party:${payload}`);
    event.dataTransfer.effectAllowed = "move";
  }
  event.stopPropagation();
  emit("drag-start-party", event, props.party);
}

function onPartyDragEnd() {
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
      <template v-if="canEdit && editingName">
        <UInput
          v-model="editingNameValue"
          class="flex-1 text-sm"
          autofocus
          @keyup.enter="commitEditName"
          @keyup.escape="editingName = false"
          @blur="commitEditName"
        />
        <UButton color="primary" variant="ghost" size="xs" icon="i-lucide-check" square @click="commitEditName" />
      </template>
      <template v-else>
        <p
          class="flex-1 truncate text-sm font-semibold"
          :class="canEdit ? 'cursor-pointer text-slate-100 hover:text-white' : 'text-slate-100'"
          :title="canEdit ? 'Click to rename' : undefined"
          @click="canEdit && startEditName()"
        >{{ party.name }}</p>
      </template>

      <template v-if="canEdit && editingCategory">
        <USelect
          :model-value="party.category"
          :items="partyCategoryOptions"
          value-key="value"
          label-key="label"
          class="w-24"
          autofocus
          @update:model-value="(v: string) => commitEditCategory(v)"
          @blur="editingCategory = false"
        />
      </template>
      <template v-else>
        <span
          class="shrink-0 text-xs font-semibold"
          :class="[canEdit ? 'cursor-pointer' : '', party.category === 'Main' ? 'text-amber-300' : 'text-slate-400']"
          :title="canEdit ? 'Click to change category' : undefined"
          @click="canEdit && (editingCategory = true)"
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
            @dragover="emit('drag-over-member-zone', $event)"
            @dragleave="emit('drag-leave-member-zone', $event)"
            @drop="emit('drop-member-reorder', $event, party, idx)"
          >
            <PlayerMiniCard
              :player="member"
              :actor-id="actorId"
              :ranks="classRanksByPlayerId"
              :draggable="canEdit"
              :can-suggest="canEdit"
              :busy="busy"
              @open-progression="emit('open-progression', member)"
              @suggest="emit('suggest-class', party, member)"
              @dragstart="emit('drag-start-member', $event, party, member)"
              @dragend="emit('drag-end-member')"
            />
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

    <!-- Missing capabilities section -->
    <div v-if="party.missingCapabilities && party.missingCapabilities.length > 0" class="border-t border-slate-800 bg-slate-950/80">
      <div class="px-3 py-2">
        <h4 class="mb-2 text-xs font-semibold text-amber-300">Missing in this party:</h4>
        <div class="space-y-1.5">
          <div v-for="gap in party.missingCapabilities" :key="gap.capability" class="flex flex-col gap-1">
            <p class="text-xs text-amber-200">{{ gap.capability }}</p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="rec in gap.recommendedClasses"
                :key="`${rec.job}:${rec.classRole}`"
                type="button"
                class="rounded bg-cyan-900/50 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-800/70 transition-colors"
                @click="emit('suggest-class-recommendation', party, rec.job, rec.classRole)"
              >
                {{ rec.job }} ({{ rec.classRole }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notes footer -->
    <div class="border-t border-slate-800 bg-slate-950/60">
      <template v-if="canEdit && editingNote">
        <div class="flex items-start gap-2 px-3 py-2">
          <UTextarea
            v-model="editingNoteValue"
            placeholder="Add a note…"
            :rows="2"
            class="flex-1 text-xs"
            autofocus
          />
          <UButton color="primary" variant="ghost" size="xs" icon="i-lucide-check" square @click="commitEditNote" />
        </div>
      </template>
      <template v-else>
        <div
          v-if="party.notes"
          class="flex items-start gap-1.5 px-3 py-2"
          :class="canEdit ? 'cursor-pointer hover:bg-slate-800/40' : ''"
          @click="canEdit ? startEditNote() : undefined"
        >
          <UIcon name="i-lucide-notebook" class="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
          <p class="text-[11px] leading-snug text-amber-400">{{ party.notes }}</p>
        </div>
        <button
          v-else-if="canEdit"
          type="button"
          class="flex w-full items-center gap-1 px-3 py-2 text-[11px] text-slate-600 hover:text-slate-400"
          @click="startEditNote()"
        >
          <UIcon name="i-lucide-notebook" class="h-3 w-3" />
          Add note
        </button>
        <div v-else class="px-3 py-2 text-[11px] text-slate-700 italic">No notes</div>
      </template>
    </div>
  </article>
</template>
