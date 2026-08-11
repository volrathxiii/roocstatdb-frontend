<script setup lang="ts">
definePageMeta({ layout: "authenticated" });

const { auth } = useAuth();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;

const canEdit = computed(() => auth.value.role === "Officer" || auth.value.role === "Admin");

interface EventItem {
  id: number;
  name: string;
  eventType: string | null;
  status: "Draft" | "Locked" | "Archived";
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  partyCount: number;
}

interface PartyMember {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  position: number;
  snapshot: {
    weekNumber: number;
    year: number;
    job: string;
    classRole: string;
  } | null;
}

interface Party {
  id: number;
  name: string;
  category: "Main" | "Sub";
  notes: string | null;
  position: number;
  members: PartyMember[];
}

interface SetupResponse {
  event: {
    id: number;
    name: string;
    eventType: string | null;
    status: "Draft" | "Locked" | "Archived";
    startsAt: string | null;
    endsAt: string | null;
  };
  parties: Party[];
}

interface RosterPlayer {
  id: number;
  ign: string;
  playerId: string;
  role: string | null;
  snapshot: {
    job: string;
    classRole: string;
  } | null;
  classScores: {
    physical: number;
    magic: number;
    defensive: number;
  } | null;
}

const loading = ref(true);
const loadingSetup = ref(false);
const busy = ref(false);
const isDraggingMember = ref(false);
const hoveredDropZone = ref<string | null>(null);
const errorMsg = ref<string | null>(null);

const events = ref<EventItem[]>([]);
const selectedEventId = ref<number | null>(null);
const selectedEvent = ref<SetupResponse["event"] | null>(null);
const parties = ref<Party[]>([]);
const rosterPlayers = ref<RosterPlayer[]>([]);

const showCreateEventModal = ref(false);
const createEventForm = reactive({
  name: "",
  eventType: "",
  startsAt: "",
  endsAt: "",
});

const showCloneEventModal = ref(false);
const cloneEventName = ref("");

const confirmDeleteEventOpen = ref(false);

async function deleteCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    await $fetch(`${backendUrl}/api/party-setup/events/${selectedEventId.value}`, {
      method: "DELETE",
      query: { playerId: actorPlayerId.value },
    });
    confirmDeleteEventOpen.value = false;
    selectedEventId.value = null;
    selectedEvent.value = null;
    parties.value = [];
    await fetchEvents();
  } catch {
    errorMsg.value = "Failed to delete event.";
  } finally {
    busy.value = false;
  }
}

const showCreatePartyModal = ref(false);
const createPartyName = ref("");
const createPartyCategory = ref<"Main" | "Sub">("Main");

const editingNamePartyId = ref<number | null>(null);
const editingNameValue = ref("");

function startEditName(party: Party) {
  if (!canEdit.value) return;
  editingNamePartyId.value = party.id;
  editingNameValue.value = party.name;
}

async function commitEditName(party: Party) {
  const trimmed = editingNameValue.value.trim();
  editingNamePartyId.value = null;
  if (!trimmed || trimmed === party.name) return;
  party.name = trimmed;
  await renameParty(party);
}

function cancelEditName() {
  editingNamePartyId.value = null;
  editingNameValue.value = "";
}

const editingCategoryPartyId = ref<number | null>(null);

const editingNotePartyId = ref<number | null>(null);
const editingNoteValue = ref("");

function startEditNote(party: Party) {
  if (!canEdit.value) return;
  editingNotePartyId.value = party.id;
  editingNoteValue.value = party.notes ?? "";
}

async function commitEditNote(party: Party) {
  const trimmed = editingNoteValue.value.trim();
  editingNotePartyId.value = null;
  const next = trimmed || null;
  if (next === party.notes) return;
  party.notes = next;
  try {
    await $fetch(`${backendUrl}/api/party-setup/parties/${party.id}`, {
      method: "PATCH",
      body: { playerId: actorPlayerId.value, notes: next },
    });
  } catch {
    errorMsg.value = "Failed to save note.";
    await onEventChange();
  }
}

function startEditCategory(party: Party) {
  if (!canEdit.value) return;
  editingCategoryPartyId.value = party.id;
}

async function commitEditCategory(party: Party, value: "Main" | "Sub") {
  editingCategoryPartyId.value = null;
  if (value === party.category) return;
  party.category = value;
  await changePartyCategory(party);
}

const poolSearch = ref("");
const poolJobFilter = ref<string | null>(null);
const poolRoleFilter = ref<string | null>(null);

const actorPlayerId = computed(() => auth.value.player?.playerId ?? "");
const actorId = computed(() => auth.value.player?.id ?? null);

const partyCategoryOptions = [
  { label: "Main", value: "Main" },
  { label: "Sub", value: "Sub" },
];

const eventOptions = computed(() =>
  events.value.map((event) => ({
    label: `${event.name} (${event.partyCount})`,
    value: event.id,
  })),
);

const assignedPlayers = computed(() => {
  const ids = new Set<number>();
  for (const party of parties.value) {
    for (const member of party.members) {
      ids.add(member.id);
    }
  }
  return ids;
});

const poolJobOptions = computed(() => {
  const values = Array.from(
    new Set(
      rosterPlayers.value
        .map((player) => player.snapshot?.job)
        .filter((job): job is string => Boolean(job)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return [
    { label: "All Jobs", value: null },
    ...values.map((value) => ({ label: value, value })),
  ];
});

const poolRoleOptions = computed(() => {
  const values = Array.from(
    new Set(
      rosterPlayers.value
        .map((player) => player.snapshot?.classRole)
        .filter((role): role is string => Boolean(role)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return [
    { label: "All Class Roles", value: null },
    ...values.map((value) => ({ label: value, value })),
  ];
});

const filteredRosterPlayers = computed(() => {
  const search = poolSearch.value.trim().toLowerCase();
  return rosterPlayers.value.filter((player) => {
    if (assignedPlayers.value.has(player.id)) {
      return false;
    }
    if (search && !player.ign.toLowerCase().includes(search)) {
      return false;
    }
    if (poolJobFilter.value && player.snapshot?.job !== poolJobFilter.value) {
      return false;
    }
    if (poolRoleFilter.value && player.snapshot?.classRole !== poolRoleFilter.value) {
      return false;
    }
    return true;
  });
});

function ensureMemberAccess() {
  if (!auth.value.player) {
    navigateTo("/login");
    return false;
  }
  if (auth.value.role === "Applicant" || auth.value.role === "Waitlisted") {
    navigateTo("/applicant");
    return false;
  }
  return true;
}

async function fetchEvents() {
  const res = await $fetch<{ events: EventItem[] }>(`${backendUrl}/api/party-setup/events`, {
    query: { playerId: actorPlayerId.value },
  });
  events.value = res.events;
  if (res.events.length === 0) {
    selectedEventId.value = null;
    selectedEvent.value = null;
    parties.value = [];
    return;
  }
  if (!selectedEventId.value || !res.events.some((event) => event.id === selectedEventId.value)) {
    selectedEventId.value = res.events[0].id;
  }
}

async function fetchSetup(eventId: number) {
  loadingSetup.value = true;
  try {
    const res = await $fetch<SetupResponse>(`${backendUrl}/api/party-setup/events/${eventId}`, {
      query: { playerId: actorPlayerId.value },
    });
    selectedEvent.value = res.event;
    parties.value = [...res.parties].sort((a, b) => a.position - b.position);
  } finally {
    loadingSetup.value = false;
  }
}

async function fetchRosterPlayers() {
  const pageSize = 100;
  let page = 1;
  let total = 0;
  const all: RosterPlayer[] = [];

  do {
    const res = await $fetch<{ players: RosterPlayer[]; total: number }>(`${backendUrl}/api/players/members`, {
      query: {
        page,
        pageSize,
      },
    });
    all.push(...res.players);
    total = res.total;
    page += 1;
  } while (all.length < total);

  rosterPlayers.value = all;
}

async function loadAll() {
  if (!ensureMemberAccess()) return;
  loading.value = true;
  errorMsg.value = null;
  try {
    await Promise.all([fetchEvents(), fetchRosterPlayers()]);
    if (selectedEventId.value) {
      await fetchSetup(selectedEventId.value);
    }
  } catch {
    errorMsg.value = "Failed to load party setup.";
  } finally {
    loading.value = false;
  }
}

async function onEventChange() {
  if (!selectedEventId.value) return;
  errorMsg.value = null;
  try {
    await fetchSetup(selectedEventId.value);
  } catch {
    errorMsg.value = "Failed to load selected event.";
  }
}

async function createEvent() {
  if (!canEdit.value) return;
  const name = createEventForm.name.trim();
  if (!name) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    const payload: Record<string, string> = {
      playerId: actorPlayerId.value,
      name,
    };
    if (createEventForm.eventType.trim()) payload.eventType = createEventForm.eventType.trim();
    if (createEventForm.startsAt) payload.startsAt = new Date(createEventForm.startsAt).toISOString();
    if (createEventForm.endsAt) payload.endsAt = new Date(createEventForm.endsAt).toISOString();

    const res = await $fetch<{ event: EventItem }>(`${backendUrl}/api/party-setup/events`, {
      method: "POST",
      body: payload,
    });

    showCreateEventModal.value = false;
    createEventForm.name = "";
    createEventForm.eventType = "";
    createEventForm.startsAt = "";
    createEventForm.endsAt = "";

    await fetchEvents();
    selectedEventId.value = res.event.id;
    await fetchSetup(res.event.id);
  } catch {
    errorMsg.value = "Failed to create event.";
  } finally {
    busy.value = false;
  }
}

async function cloneCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    const payload: Record<string, string> = { playerId: actorPlayerId.value };
    if (cloneEventName.value.trim()) payload.name = cloneEventName.value.trim();

    const res = await $fetch<{ event: EventItem }>(`${backendUrl}/api/party-setup/events/${selectedEventId.value}/clone`, {
      method: "POST",
      body: payload,
    });

    showCloneEventModal.value = false;
    cloneEventName.value = "";

    await fetchEvents();
    selectedEventId.value = res.event.id;
    await fetchSetup(res.event.id);
  } catch {
    errorMsg.value = "Failed to clone event.";
  } finally {
    busy.value = false;
  }
}

async function createParty() {
  if (!canEdit.value || !selectedEventId.value) return;
  const name = createPartyName.value.trim();
  if (!name) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    await $fetch(`${backendUrl}/api/party-setup/events/${selectedEventId.value}/parties`, {
      method: "POST",
      body: {
        playerId: actorPlayerId.value,
        name,
        category: createPartyCategory.value,
      },
    });

    showCreatePartyModal.value = false;
    createPartyName.value = "";
    createPartyCategory.value = "Main";
    await fetchEvents();
    await fetchSetup(selectedEventId.value);
  } catch {
    errorMsg.value = "Failed to create party.";
  } finally {
    busy.value = false;
  }
}

async function renameParty(party: Party) {
  if (!canEdit.value) return;
  const name = party.name.trim();
  if (!name) return;

  try {
    await $fetch(`${backendUrl}/api/party-setup/parties/${party.id}`, {
      method: "PATCH",
      body: {
        playerId: actorPlayerId.value,
        name,
      },
    });
  } catch {
    errorMsg.value = "Failed to rename party.";
    await onEventChange();
  }
}

async function changePartyCategory(party: Party) {
  if (!canEdit.value) return;
  try {
    await $fetch(`${backendUrl}/api/party-setup/parties/${party.id}`, {
      method: "PATCH",
      body: {
        playerId: actorPlayerId.value,
        category: party.category,
      },
    });
  } catch {
    errorMsg.value = "Failed to update party category.";
    await onEventChange();
  }
}

async function deleteParty(party: Party) {
  if (!canEdit.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    const res = await $fetch<SetupResponse>(`${backendUrl}/api/party-setup/parties/${party.id}`, {
      method: "DELETE",
      query: {
        playerId: actorPlayerId.value,
      },
    });
    selectedEvent.value = res.event;
    parties.value = [...res.parties].sort((a, b) => a.position - b.position);
    await fetchEvents();
  } catch {
    errorMsg.value = "Failed to delete party.";
  } finally {
    busy.value = false;
  }
}

async function savePartyMembers(party: Party, memberIds: number[]) {
  if (!canEdit.value) return;
  if (memberIds.length > 5) {
    errorMsg.value = "A party can only have up to 5 members.";
    return;
  }

  busy.value = true;
  errorMsg.value = null;
  try {
    const res = await $fetch<SetupResponse>(`${backendUrl}/api/party-setup/parties/${party.id}/members`, {
      method: "PATCH",
      body: {
        playerId: actorPlayerId.value,
        memberIds,
      },
    });
    selectedEvent.value = res.event;
    parties.value = [...res.parties].sort((a, b) => a.position - b.position);
    await fetchEvents();
  } catch {
    errorMsg.value = "Failed to update party members.";
  } finally {
    busy.value = false;
  }
}

function onDragStartMember(event: DragEvent, party: Party, member: PartyMember) {
  if (!canEdit.value) return;
  isDraggingMember.value = true;
  event.dataTransfer?.setData("text/member-party-id", String(party.id));
  event.dataTransfer?.setData("text/member-id", String(member.id));
  event.dataTransfer?.setData("text/player-id", String(member.id)); // also set for pool/cross-party drops
  event.dataTransfer!.effectAllowed = "move";
}

function onDragOverMemberZone(event: DragEvent) {
  event.preventDefault();
  event.dataTransfer!.dropEffect = "move";
  (event.currentTarget as HTMLElement)?.classList.add("bg-cyan-900/30");
}

function onDragLeaveMemberZone(event: DragEvent) {
  (event.currentTarget as HTMLElement)?.classList.remove("bg-cyan-900/30");
}

async function onDropMemberReorder(event: DragEvent, targetParty: Party, targetIndex: number) {
  isDraggingMember.value = false;
  hoveredDropZone.value = null;
  if (!canEdit.value) return;
  event.preventDefault();

  const sourcePartyId = Number.parseInt(event.dataTransfer?.getData("text/member-party-id") ?? "", 10);
  const memberId = Number.parseInt(event.dataTransfer?.getData("text/member-id") ?? "", 10);

  // Not a member drag — let event bubble up to article drop handler (pool player)
  if (!Number.isInteger(sourcePartyId) || !Number.isInteger(memberId)) return;

  // Member drag — stop propagation so article handler doesn't also fire
  event.stopPropagation();

  if (sourcePartyId === targetParty.id) {
    // Same-party reorder
    const member = targetParty.members.find((m) => m.id === memberId);
    if (!member) return;
    const currentIndex = targetParty.members.indexOf(member);
    if (currentIndex === targetIndex) return;
    const newMembers = [...targetParty.members];
    newMembers.splice(currentIndex, 1);
    newMembers.splice(targetIndex, 0, member);
    try {
      await $fetch(`${backendUrl}/api/party-setup/parties/${targetParty.id}/members/reorder`, {
        method: "PATCH",
        body: { playerId: actorPlayerId.value, memberIds: newMembers.map((m) => m.id) },
      });
      targetParty.members = newMembers;
    } catch (e: any) {
      errorMsg.value = e.data?.message || "Failed to reorder members.";
      await onEventChange();
    }
  } else {
    // Cross-party move — insert at specific position in target
    const sourceParty = parties.value.find((p) => p.id === sourcePartyId);
    if (!sourceParty) return;
    const member = sourceParty.members.find((m) => m.id === memberId);
    if (!member) return;
    if (targetParty.members.length >= 5) {
      errorMsg.value = "This party is already full (max 5).";
      return;
    }
    const newSourceIds = sourceParty.members.filter((m) => m.id !== memberId).map((m) => m.id);
    const newTargetMembers = [...targetParty.members];
    newTargetMembers.splice(targetIndex, 0, member);
    const newTargetIds = newTargetMembers.map((m) => m.id);
    try {
      await Promise.all([
        savePartyMembers(sourceParty, newSourceIds),
        savePartyMembers(targetParty, newTargetIds),
      ]);
    } catch (e: any) {
      errorMsg.value = e.data?.message || "Failed to move member.";
      await onEventChange();
    }
  }
}

function onDragStartPlayer(event: DragEvent, playerId: number) {
  if (!canEdit.value) return;
  event.dataTransfer?.setData("text/player-id", String(playerId));
  event.dataTransfer!.effectAllowed = "move";
}

function findPartyByMemberId(memberId: number) {
  return parties.value.find((party) =>
    party.members.some((member) => member.id === memberId),
  ) ?? null;
}

function onDragOverParty(event: DragEvent) {
  if (!canEdit.value) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
}

async function onDropToParty(event: DragEvent, party: Party) {
  if (!canEdit.value) return;
  event.preventDefault();
  
  // If this is a same-party drag, the inner reorder handler already dealt with it
  const memberPartyId = event.dataTransfer?.getData("text/member-party-id");
  if (memberPartyId && memberPartyId === String(party.id)) return;
  
  const payload = event.dataTransfer?.getData("text/player-id") ?? "";
  const playerId = Number.parseInt(payload, 10);
  if (!Number.isInteger(playerId)) return;

  const current = party.members.map((member) => member.id);
  if (current.includes(playerId)) return;
  if (current.length >= 5) {
    errorMsg.value = "This party is already full (max 5).";
    return;
  }

  await savePartyMembers(party, [...current, playerId]);
}

async function onDropToPool(event: DragEvent) {
  if (!canEdit.value) return;
  event.preventDefault();
  // Accept both pool-player drags and party-member drags
  const payload = event.dataTransfer?.getData("text/player-id") || event.dataTransfer?.getData("text/member-id") || "";
  const playerId = Number.parseInt(payload, 10);
  if (!Number.isInteger(playerId)) return;

  const sourceParty = findPartyByMemberId(playerId);
  if (!sourceParty) return;

  const nextMembers = sourceParty.members
    .filter((member) => member.id !== playerId)
    .map((member) => member.id);
  await savePartyMembers(sourceParty, nextMembers);
}

async function removeFromParty(party: Party, memberId: number) {
  if (!canEdit.value) return;
  const nextMembers = party.members
    .filter((member) => member.id !== memberId)
    .map((member) => member.id);
  await savePartyMembers(party, nextMembers);
}

function ordinal(n: number | undefined) {
  if (n === undefined) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function roleBadgeClass(role: string | null) {
  if (role === "Admin") return "bg-rose-500/20 text-rose-300 border-rose-500/50";
  if (role === "Officer") return "bg-sky-500/20 text-sky-300 border-sky-500/50";
  return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
}

function stringHash(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function jobTextClass(job: string | undefined) {
  if (!job) return "text-slate-400";
  const palette = [
    "text-amber-300",
    "text-cyan-300",
    "text-fuchsia-300",
    "text-lime-300",
    "text-orange-300",
    "text-violet-300",
  ];
  return palette[stringHash(job) % palette.length];
}

function classRoleTextClass(classRole: string | undefined) {
  if (!classRole) return "text-slate-400";
  const palette = [
    "text-pink-300",
    "text-teal-300",
    "text-indigo-300",
    "text-yellow-300",
    "text-red-300",
    "text-blue-300",
  ];
  return palette[stringHash(classRole) % palette.length];
}

const classRanksByPlayerId = computed(() => {
  const grouped = new Map<string, RosterPlayer[]>();
  for (const player of rosterPlayers.value) {
    if (!player.snapshot || !player.classScores) continue;
    const key = `${player.snapshot.job}::${player.snapshot.classRole}`;
    const group = grouped.get(key);
    if (group) {
      group.push(player);
    } else {
      grouped.set(key, [player]);
    }
  }

  const output = new Map<number, {
    physical: { rank: number; total: number };
    magic: { rank: number; total: number };
    defensive: { rank: number; total: number };
  }>();

  for (const players of grouped.values()) {
    const total = players.length;
    const stats: Array<"physical" | "magic" | "defensive"> = ["physical", "magic", "defensive"];
    const rankMaps = new Map<"physical" | "magic" | "defensive", Map<number, number>>();

    for (const stat of stats) {
      const sorted = [...players].sort((a, b) => (b.classScores?.[stat] ?? 0) - (a.classScores?.[stat] ?? 0));
      const ranks = new Map<number, number>();
      for (let index = 0; index < sorted.length; index += 1) {
        ranks.set(sorted[index].id, index + 1);
      }
      rankMaps.set(stat, ranks);
    }

    for (const player of players) {
      output.set(player.id, {
        physical: { rank: rankMaps.get("physical")?.get(player.id) ?? total, total },
        magic: { rank: rankMaps.get("magic")?.get(player.id) ?? total, total },
        defensive: { rank: rankMaps.get("defensive")?.get(player.id) ?? total, total },
      });
    }
  }

  return output;
});

function bestRankStat(playerId: number) {
  const ranks = classRanksByPlayerId.value.get(playerId);
  if (!ranks) return [] as Array<"physical" | "magic" | "defensive">;
  const entries: Array<["physical" | "magic" | "defensive", number]> = [
    ["physical", ranks.physical.rank],
    ["magic", ranks.magic.rank],
    ["defensive", ranks.defensive.rank],
  ];
  const minRank = Math.min(...entries.map((entry) => entry[1]));
  return entries.filter((entry) => entry[1] === minRank).map((entry) => entry[0]);
}

watch(selectedEventId, async () => {
  if (selectedEventId.value) await onEventChange();
});

onMounted(async () => {
  if (!ensureMemberAccess()) return;
  setSubtitle("Party Setup");
  await loadAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="selectedEventId"
        :items="eventOptions"
        value-key="value"
        label-key="label"
        placeholder="Select event"
        class="w-full sm:w-72"
      />

      <UButton
        v-if="canEdit"
        color="primary"
        variant="soft"
        icon="i-lucide-calendar-plus"
        @click="showCreateEventModal = true"
      >
        New Event
      </UButton>

      <UButton
        v-if="canEdit && selectedEventId"
        color="neutral"
        variant="outline"
        icon="i-lucide-copy"
        @click="showCloneEventModal = true"
      >
        Clone Event
      </UButton>

      <UButton
        v-if="canEdit && selectedEventId"
        color="error"
        variant="outline"
        icon="i-lucide-trash-2"
        @click="confirmDeleteEventOpen = true"
      >
        Delete Event
      </UButton>

      <UBadge
        v-if="selectedEvent"
        class="ml-auto"
        color="neutral"
        variant="soft"
      >
        {{ selectedEvent.status }}
      </UBadge>
    </div>

    <UAlert v-if="errorMsg" color="error" variant="soft" :description="errorMsg" />

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-slate-400" />
    </div>

    <div v-else class="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Parties</h2>
          <UButton
            v-if="canEdit && selectedEventId"
            color="primary"
            variant="solid"
            icon="i-lucide-plus"
            @click="showCreatePartyModal = true"
          >
            Create Party
          </UButton>
        </div>

        <div v-if="loadingSetup" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          Loading setup...
        </div>

        <div v-else-if="!selectedEventId" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          No event yet. Create one to start.
        </div>

        <div v-else-if="parties.length === 0" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          No parties in this event yet.
        </div>

        <div v-else class="space-y-4">
          <div v-for="category in (['Main', 'Sub'] as const)" :key="category">
            <div v-if="parties.some(p => p.category === category)" class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-widest" :class="category === 'Main' ? 'text-amber-400/70' : 'text-slate-500'">{{ category }}</p>
              <div class="flex flex-wrap items-start gap-3">
                <template v-for="party in parties" :key="party.id">
                  <PartyCard
                    v-if="party.category === category"
                    :party="party"
                    :can-edit="canEdit"
                    :busy="busy"
                    :actor-id="actorId"
                    :editing-name-party-id="editingNamePartyId"
                    :editing-name-value="editingNameValue"
                    :editing-category-party-id="editingCategoryPartyId"
                    :editing-note-party-id="editingNotePartyId"
                    :editing-note-value="editingNoteValue"
                    :is-dragging-member="isDraggingMember"
                    :hovered-drop-zone="hoveredDropZone"
                    :party-category-options="partyCategoryOptions"
                    @update:editing-name-value="editingNameValue = $event"
                    @update:editing-note-value="editingNoteValue = $event"
                    @update:hovered-drop-zone="hoveredDropZone = $event"
                    @start-edit-name="startEditName"
                    @commit-edit-name="commitEditName"
                    @cancel-edit-name="cancelEditName"
                    @start-edit-category="startEditCategory"
                    @commit-edit-category="commitEditCategory"
                    @cancel-edit-category="editingCategoryPartyId = null"
                    @start-edit-note="startEditNote"
                    @commit-edit-note="commitEditNote"
                    @delete-party="deleteParty"
                    @remove-from-party="removeFromParty"
                    @drag-over-party="onDragOverParty"
                    @drop-to-party="onDropToParty"
                    @drag-over-member-zone="onDragOverMemberZone"
                    @drag-leave-member-zone="onDragLeaveMemberZone"
                    @drag-start-member="onDragStartMember"
                    @drag-end-member="isDraggingMember = false; hoveredDropZone = null"
                    @drop-member-reorder="onDropMemberReorder"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside
        v-if="canEdit"
        class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
        @dragover="onDragOverParty"
        @drop="onDropToPool($event)"
      >
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Members Pool</h3>
          <UBadge color="neutral" variant="soft">{{ filteredRosterPlayers.length }}</UBadge>
        </div>

        <div class="mb-3 space-y-2">
          <UInput
            v-model="poolSearch"
            icon="i-lucide-search"
            placeholder="Search IGN"
            class="w-full"
          />
          <div class="grid gap-2 sm:grid-cols-2">
            <USelect
              v-model="poolJobFilter"
              :items="poolJobOptions"
              value-key="value"
              label-key="label"
              placeholder="All Jobs"
            />
            <USelect
              v-model="poolRoleFilter"
              :items="poolRoleOptions"
              value-key="value"
              label-key="label"
              placeholder="All Class Roles"
            />
          </div>
        </div>

        <div class="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          <article
            v-for="player in filteredRosterPlayers"
            :key="player.id"
            class="cursor-grab rounded-lg border p-3"
            :class="player.id === actorId ? 'bg-emerald-900/40' : (assignedPlayers.has(player.id) ? 'border-slate-700 bg-slate-900/70 opacity-60' : 'border-slate-700 bg-slate-900/70')"
            :style="player.id === actorId ? 'border-color: #10b981;' : ''"
            :draggable="canEdit"
            @dragstart="onDragStartPlayer($event, player.id)"
          >
            <div class="flex items-center justify-between">
              <p class="text-sm font-semibold text-slate-100">{{ player.ign }}</p>
              <span
                :class="['rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', roleBadgeClass(player.role)]"
              >
                {{ player.role ?? "Member" }}
              </span>
            </div>
            <p class="text-xs">
              <span :class="jobTextClass(player.snapshot?.job)">{{ player.snapshot?.job ?? "Unknown" }}</span>
              <span class="text-slate-500"> - </span>
              <span :class="classRoleTextClass(player.snapshot?.classRole)">{{ player.snapshot?.classRole ?? "Unknown" }}</span>
            </p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span
                class="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
                :class="bestRankStat(player.id).includes('physical') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                title="Physical DMG rank"
              >
                <UIcon name="i-lucide-sword" class="h-3 w-3 shrink-0" />
                {{ ordinal(classRanksByPlayerId.get(player.id)?.physical.rank) }}
              </span>
              <span
                class="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
                :class="bestRankStat(player.id).includes('magic') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                title="Magic DMG rank"
              >
                <UIcon name="i-lucide-sparkles" class="h-3 w-3 shrink-0" />
                {{ ordinal(classRanksByPlayerId.get(player.id)?.magic.rank) }}
              </span>
              <span
                class="flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
                :class="bestRankStat(player.id).includes('defensive') ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200' : ''"
                title="Defensive rank"
              >
                <UIcon name="i-lucide-shield" class="h-3 w-3 shrink-0" />
                {{ ordinal(classRanksByPlayerId.get(player.id)?.defensive.rank) }}
              </span>
            </div>
          </article>
        </div>
      </aside>
    </div>
  </div>

  <UModal v-model:open="showCreateEventModal">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Create Event</span>
        </template>

        <div class="space-y-3">
          <UFormField label="Event Name" required>
            <UInput v-model="createEventForm.name" placeholder="WoE Saturday" class="w-full" />
          </UFormField>
          <UFormField label="Event Type">
            <UInput v-model="createEventForm.eventType" placeholder="WoE" class="w-full" />
          </UFormField>
          <div class="grid gap-2 sm:grid-cols-2">
            <UFormField label="Starts At">
              <UInput v-model="createEventForm.startsAt" type="datetime-local" class="w-full" />
            </UFormField>
            <UFormField label="Ends At">
              <UInput v-model="createEventForm.endsAt" type="datetime-local" class="w-full" />
            </UFormField>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showCreateEventModal = false">Cancel</UButton>
            <UButton color="primary" :loading="busy" @click="createEvent">Create</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="showCloneEventModal">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Clone Event</span>
        </template>

        <div class="space-y-3">
          <UFormField label="New Event Name">
            <UInput v-model="cloneEventName" placeholder="Optional custom name" class="w-full" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showCloneEventModal = false">Cancel</UButton>
            <UButton color="primary" :loading="busy" @click="cloneCurrentEvent">Clone</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="confirmDeleteEventOpen">
    <template #content>
      <UCard class="border border-rose-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Delete Event</span>
        </template>
        <div class="space-y-2">
          <p class="text-sm text-slate-200">Are you sure you want to delete <span class="font-semibold text-white">{{ selectedEvent?.name }}</span>?</p>
          <p class="text-sm text-rose-300">This will permanently delete all parties and member assignments for this event.</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="confirmDeleteEventOpen = false">Cancel</UButton>
            <UButton color="error" :loading="busy" @click="deleteCurrentEvent">Delete</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="showCreatePartyModal">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Create Party</span>
        </template>

        <div class="space-y-3">
          <UFormField label="Party Name" required>
            <UInput v-model="createPartyName" placeholder="Party A" class="w-full" />
          </UFormField>
          <UFormField label="Field" required>
            <div class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                :class="createPartyCategory === 'Main'
                  ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200'"
                @click="createPartyCategory = 'Main'"
              >
                Main
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
                :class="createPartyCategory === 'Sub'
                  ? 'border-slate-400/70 bg-slate-500/20 text-slate-200'
                  : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500 hover:text-slate-200'"
                @click="createPartyCategory = 'Sub'"
              >
                Sub
              </button>
            </div>
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showCreatePartyModal = false">Cancel</UButton>
            <UButton color="primary" :loading="busy" @click="createParty">Create</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
