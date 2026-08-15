<script setup lang="ts">
definePageMeta({ layout: "authenticated", middleware: "auth" });

const { auth } = useAuth();
const api = useApi();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();

const canEdit = useCanEdit();

interface EventItem {
  id: number;
  shareToken: string;
  name: string;
  eventType: string | null;
  status: "Locked" | "Archived";
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  publishedAt: string | null;
  partyCount: number;
  mainCommander: { ign: string; playerId: string } | null;
  subCommander: { ign: string; playerId: string } | null;
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
  suggestion: {
    job: string;
    jobId: number;
    classRole: string;
    classRoleId: number;
  } | null;
}

interface Party {
  id: number;
  name: string;
  category: "Main" | "Sub";
  notes: string | null;
  groupId: number | null;
  position: number;
  members: PartyMember[];
}

interface PartyGroup {
  id: number;
  name: string;
  notes: string | null;
  position: number;
  partyIds: number[];
}

interface SetupResponse {
  event: {
    id: number;
    shareToken: string;
    name: string;
    eventType: string | null;
    status: "Locked" | "Archived";
    startsAt: string | null;
    endsAt: string | null;
    mainCommander: { ign: string; playerId: string } | null;
    publishedAt: string | null;
    subCommander: { ign: string; playerId: string } | null;
  };
  parties: Party[];
  groups: PartyGroup[];
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

interface RefJob {
  id: number;
  name: string;
}

interface RefClassRole {
  id: number;
  name: string;
}

interface PartyPresetRecord {
  id: number;
  position: number;
  jobId: number;
  classRoleId: number | null;
  classRank: "PDMG" | "MDMG" | "DEF" | null;
  job: { id: number; name: string };
  classRole: { id: number; name: string } | null;
}

interface PartyPreset {
  id: number;
  name: string;
  records: PartyPresetRecord[];
}

const loading = ref(true);
const loadingSetup = ref(false);
const busy = ref(false);
const isDraggingMember = ref(false);
const hoveredDropZone = ref<string | null>(null);
const errorMsg = ref<string | null>(null);

// Suggestion modal state
const showSuggestionModal = ref(false);
const suggestionMember = ref<PartyMember | null>(null);
const suggestionPartyId = ref<number | null>(null);
const suggestionForm = reactive({
  jobId: undefined as number | undefined,
  classRoleId: undefined as number | undefined,
});
const refJobs = ref<RefJob[]>([]);
const refClassRoles = ref<RefClassRole[]>([]);
const toast = useToast();

const events = ref<EventItem[]>([]);
const selectedEventId = ref<number | null>(null);
const selectedEvent = ref<SetupResponse["event"] | null>(null);
const parties = ref<Party[]>([]);
const groups = ref<PartyGroup[]>([]);
const rosterPlayers = ref<RosterPlayer[]>([]);
const partyPresets = ref<PartyPreset[]>([]);
const discordWebhookAvailable = ref(false);
const discordPosting = ref(false);
const discordPosted = ref(false);
const progressionPlayer = ref<{ id: number; playerStringId: string; ign: string } | null>(null);
const partyDragSourcePartyId = ref<number | null>(null);
const partyDragSourceGroupId = ref<number | null>(null);
const partyDragWasHandled = ref(false);
const editingGroupId = ref<number | null>(null);
const editingGroupName = ref("");
const editingGroupNotesId = ref<number | null>(null);
const editingGroupNotes = ref("");
const showPreviewModal = ref(false);
const previewLinkCopied = ref(false);

function copyPreviewLink() {
  if (!previewUrl.value) return;
  const url = window.location.origin + previewUrl.value;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      previewLinkCopied.value = true;
      setTimeout(() => { previewLinkCopied.value = false; }, 2500);
    });
  } else {
    // Fallback for browsers without clipboard API
    const el = document.createElement("textarea");
    el.value = url;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
    previewLinkCopied.value = true;
    setTimeout(() => { previewLinkCopied.value = false; }, 2500);
  }
}

const previewUrl = computed(() =>
  selectedEvent.value?.shareToken ? `/party-print/${selectedEvent.value.shareToken}` : null,
);

const commanderOptions = computed(() =>
  rosterPlayers.value.map((p) => ({ label: p.ign, value: p.playerId })),
);

function startEditGroupName(group: PartyGroup) {
  if (!canEdit.value) return;
  editingGroupId.value = group.id;
  editingGroupName.value = group.name;
}

function startEditGroupNotes(group: PartyGroup) {
  if (!canEdit.value) return;
  editingGroupNotesId.value = group.id;
  editingGroupNotes.value = group.notes ?? "";
}

function openProgressionForMember(member: PartyMember) {
  progressionPlayer.value = {
    id: member.id,
    playerStringId: member.playerId,
    ign: member.ign,
  };
}

function openProgressionForRosterPlayer(player: RosterPlayer) {
  progressionPlayer.value = {
    id: player.id,
    playerStringId: player.playerId,
    ign: player.ign,
  };
}

type EventModalMode = 'create' | 'edit';

const showEventModal = ref(false);
const eventModalMode = ref<EventModalMode>('create');
const eventForm = reactive({
  name: "",
  eventType: "",
  startsAt: "",
  mainCommanderPlayerId: undefined as string | undefined,
  subCommanderPlayerId: undefined as string | undefined,
});

function openNewEventModal() {
  eventModalMode.value = 'create';
  eventForm.name = "";
  eventForm.eventType = "";
  eventForm.startsAt = "";
  eventForm.mainCommanderPlayerId = undefined;
  eventForm.subCommanderPlayerId = undefined;
  showEventModal.value = true;
}

function openEditEventModal() {
  if (!selectedEvent.value) return;
  eventModalMode.value = 'edit';
  eventForm.name = selectedEvent.value.name;
  eventForm.eventType = selectedEvent.value.eventType ?? "";
  eventForm.startsAt = selectedEvent.value.startsAt
    ? new Date(selectedEvent.value.startsAt).toISOString().slice(0, 10)
    : "";
  eventForm.mainCommanderPlayerId = selectedEvent.value.mainCommander != null ? selectedEvent.value.mainCommander.playerId : undefined;
  eventForm.subCommanderPlayerId = selectedEvent.value.subCommander != null ? selectedEvent.value.subCommander.playerId : undefined;
  showEventModal.value = true;
}

const showCloneEventModal = ref(false);
const cloneEventName = ref("");

const confirmDeleteEventOpen = ref(false);
const confirmDeletePartyOpen = ref(false);
const partyToDelete = ref<Party | null>(null);
const confirmDeleteGroupOpen = ref(false);
const groupToDelete = ref<PartyGroup | null>(null);

function requestDeleteParty(party: Party) {
  partyToDelete.value = party;
  confirmDeletePartyOpen.value = true;
}

async function confirmDeleteParty() {
  if (!partyToDelete.value) return;
  await deleteParty(partyToDelete.value);
  confirmDeletePartyOpen.value = false;
  partyToDelete.value = null;
}

function requestDeleteGroup(group: PartyGroup) {
  groupToDelete.value = group;
  confirmDeleteGroupOpen.value = true;
}

async function confirmDeleteGroup() {
  if (!groupToDelete.value) return;
  await removeGroup(groupToDelete.value);
  confirmDeleteGroupOpen.value = false;
  groupToDelete.value = null;
}

async function deleteCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    await api.del(`/api/party-setup/events/${selectedEventId.value}`);
    confirmDeleteEventOpen.value = false;
    selectedEventId.value = null;
    selectedEvent.value = null;
    parties.value = [];
    groups.value = [];
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

// ── PartyCard simplified emit handlers ───────────────────────────────────────
async function onPartyRename(party: Party, name: string) {
  if (name === party.name) return;
  party.name = name;
  await renameParty(party);
}

async function onPartyChangeCategory(party: Party, category: "Main" | "Sub") {
  if (category === party.category) return;
  party.category = category;
  await changePartyCategory(party);
}

async function onPartyChangeNote(party: Party, note: string | null) {
  if (note === party.notes) return;
  party.notes = note;
  try {
    await api.patch(`/api/party-setup/parties/${party.id}`, { notes: note });
  } catch {
    errorMsg.value = "Failed to save note.";
    await onEventChange();
  }
}

const poolSearch = ref("");
const poolJobFilter = ref<string | null>(null);
const poolRoleFilter = ref<string | null>(null);

const actorId = computed(() => auth.value.player?.id ?? null);

const partyCategoryOptions = [
  { label: "Main", value: "Main" },
  { label: "Sub", value: "Sub" },
];

const eventPickerOpen = ref(false);
const includeExpired = ref(false);

function isEventExpired(event: EventItem): boolean {
  if (!event.startsAt) return false;
  return new Date(event.startsAt) < new Date();
}

function formatEventDate(event: EventItem): string {
  if (!event.startsAt) return "No date";
  return new Date(event.startsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

const visibleEvents = computed(() => {
  const filtered = events.value.filter((event) => includeExpired.value || !isEventExpired(event));
  return filtered.sort((a, b) => {
    const aExp = isEventExpired(a);
    const bExp = isEventExpired(b);
    if (aExp === bExp) return 0;
    return aExp ? 1 : -1;
  });
});

const unexpiredVisibleEvents = computed(() =>
  visibleEvents.value.filter((event) => !isEventExpired(event)),
);

const expiredVisibleEvents = computed(() =>
  visibleEvents.value.filter((event) => isEventExpired(event)),
);

const selectedEventForPicker = computed(() =>
  events.value.find((event) => event.id === selectedEventId.value) ?? null,
);

const selectedEventLabel = computed(() =>
  selectedEventForPicker.value
    ? `${selectedEventForPicker.value.name} (${selectedEventForPicker.value.partyCount})`
    : "Select event",
);

function selectEventFromPicker(eventId: number) {
  selectedEventId.value = eventId;
  eventPickerOpen.value = false;
}

function showExpiredEvents() {
  includeExpired.value = true;
  nextTick(() => { eventPickerOpen.value = true; });
}

function hideExpiredEvents() {
  includeExpired.value = false;
  nextTick(() => { eventPickerOpen.value = true; });
}

const assignedPlayers = computed(() => {
  const ids = new Set<number>();
  for (const party of parties.value) {
    for (const member of party.members) {
      ids.add(member.id);
    }
  }
  return ids;
});

const partiesById = computed(() => {
  const byId = new Map<number, Party>();
  for (const party of parties.value) {
    byId.set(party.id, party);
  }
  return byId;
});

function groupedPartiesByCategory(category: "Main" | "Sub") {
  return groups.value
    .map((group) => {
      const groupParties = group.partyIds
        .map((partyId) => partiesById.value.get(partyId))
        .filter((party): party is Party => party !== undefined && party.category === category)
        .sort((a, b) => a.position - b.position);
      return { group, parties: groupParties };
    })
    .filter((entry) => entry.parties.length > 0);
}

function ungroupedPartiesByCategory(category: "Main" | "Sub") {
  return parties.value
    .filter((party) => party.category === category && !party.groupId)
    .sort((a, b) => a.position - b.position);
}

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
  // Auth is now handled by the route middleware (app/middleware/auth.ts)
  return true;
}

async function fetchEvents() {
  const res = await api.get<{ events: EventItem[] }>(`/api/party-setup/events`);
  events.value = res.events;
  if (res.events.length === 0) {
    selectedEventId.value = null;
    selectedEvent.value = null;
    parties.value = [];
    groups.value = [];
    return;
  }
  if (!selectedEventId.value || !res.events.some((event) => event.id === selectedEventId.value)) {
    selectedEventId.value = res.events[0]?.id ?? null;
  }
}

async function fetchSetup(eventId: number) {
  loadingSetup.value = true;
  try {
    const res = await api.get<SetupResponse>(`/api/party-setup/events/${eventId}`);
    selectedEvent.value = res.event;
    parties.value = [...res.parties].sort((a, b) => a.position - b.position);
    groups.value = [...res.groups].sort((a, b) => a.position - b.position);
  } finally {
    loadingSetup.value = false;
  }
}

function applySetupResponse(res: SetupResponse) {
  selectedEvent.value = res.event;
  parties.value = [...res.parties].sort((a, b) => a.position - b.position);
  groups.value = [...res.groups].sort((a, b) => a.position - b.position);
}

async function fetchRosterPlayers() {
  const pageSize = 100;
  let page = 1;
  let total = 0;
  const all: RosterPlayer[] = [];

  do {
    const res = await api.get<{ players: RosterPlayer[]; total: number }>(`/api/players/members`, { page, pageSize });
    all.push(...res.players);
    total = res.total;
    page += 1;
  } while (all.length < total);

  rosterPlayers.value = all;
}

async function fetchPartyPresets() {
  try {
    const res = await api.get<{ presets: PartyPreset[] }>(`/api/party-presets`);
    partyPresets.value = res.presets;
  } catch {
    partyPresets.value = [];
  }
}

async function publishCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    const res = await api.post<{ event: EventItem }>(`/api/party-setup/events/${selectedEventId.value}/publish`);
    const idx = events.value.findIndex((e) => e.id === selectedEventId.value);
    if (idx !== -1) events.value[idx] = res.event;
    if (selectedEvent.value) selectedEvent.value = { ...selectedEvent.value, publishedAt: res.event.publishedAt };
  } catch {
    errorMsg.value = "Failed to publish event.";
  } finally {
    busy.value = false;
  }
}

async function unpublishCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    const res = await api.post<{ event: EventItem }>(`/api/party-setup/events/${selectedEventId.value}/unpublish`);
    const idx = events.value.findIndex((e) => e.id === selectedEventId.value);
    if (idx !== -1) events.value[idx] = res.event;
    if (selectedEvent.value) selectedEvent.value = { ...selectedEvent.value, publishedAt: res.event.publishedAt };
  } catch {
    errorMsg.value = "Failed to unpublish event.";
  } finally {
    busy.value = false;
  }
}

async function loadAll() {
  if (!ensureMemberAccess()) return;
  loading.value = true;
  errorMsg.value = null;
  try {
    const fetches: Promise<unknown>[] = [fetchEvents(), fetchRosterPlayers(), fetchRefData()];
    if (auth.value.role === "Admin") fetches.push(fetchPartyPresets());
    const webhookCheck = api.get<{ available: boolean }>(`/api/settings/discord-webhook-available`)
      .then((r) => { discordWebhookAvailable.value = r.available; })
      .catch(() => {});
    await Promise.all([...fetches, webhookCheck]);
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

async function postToDiscord() {
  if (!canEdit.value || !selectedEventId.value || discordPosting.value) return;
  discordPosting.value = true;
  try {
    await api.post(`/api/party-setup/events/${selectedEventId.value}/notify-discord`, { printBaseUrl: window.location.origin });
    discordPosted.value = true;
    setTimeout(() => { discordPosted.value = false; }, 3000);
  } catch {
    errorMsg.value = "Failed to post to Discord.";
  } finally {
    discordPosting.value = false;
  }
}

async function saveEvent() {
  if (!canEdit.value) return;
  const name = eventForm.name.trim();
  if (!name) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    if (eventModalMode.value === 'create') {
      // Create mode
      const payload: Record<string, string | null> = {
        name,
      };
      if (eventForm.eventType.trim()) payload.eventType = eventForm.eventType.trim();
      if (eventForm.startsAt) payload.startsAt = new Date(eventForm.startsAt).toISOString();
      if (eventForm.mainCommanderPlayerId) payload.mainCommanderPlayerId = eventForm.mainCommanderPlayerId;
      if (eventForm.subCommanderPlayerId) payload.subCommanderPlayerId = eventForm.subCommanderPlayerId;

      const res = await api.post<{ event: EventItem }>(`/api/party-setup/events`, payload);

      await fetchEvents();
      selectedEventId.value = res.event.id;
      await fetchSetup(res.event.id);
    } else {
      // Edit mode
      if (!selectedEventId.value) return;
      const body: Record<string, string | null> = {
        name,
        eventType: eventForm.eventType.trim() || null,
        startsAt: eventForm.startsAt ? new Date(eventForm.startsAt).toISOString() : null,
        mainCommanderPlayerId: eventForm.mainCommanderPlayerId ?? null,
        subCommanderPlayerId: eventForm.subCommanderPlayerId ?? null,
      };

      const res = await api.patch<{ event: EventItem }>(`/api/party-setup/events/${selectedEventId.value}`, body);

      selectedEvent.value = res.event;
      await fetchEvents();
    }

    showEventModal.value = false;
  } catch {
    errorMsg.value = eventModalMode.value === 'create' ? "Failed to create event." : "Failed to update event.";
  } finally {
    busy.value = false;
  }
}

async function cloneCurrentEvent() {
  if (!canEdit.value || !selectedEventId.value) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    const payload: Record<string, string> = {};
    if (cloneEventName.value.trim()) payload.name = cloneEventName.value.trim();

    const res = await api.post<{ event: EventItem }>(`/api/party-setup/events/${selectedEventId.value}/clone`, payload);

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
    await api.post(`/api/party-setup/events/${selectedEventId.value}/parties`, {
        name,
        category: createPartyCategory.value,
      },
    );

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
    await api.patch(`/api/party-setup/parties/${party.id}`, {
      name,
    });
  } catch {
    errorMsg.value = "Failed to rename party.";
    await onEventChange();
  }
}

async function changePartyCategory(party: Party) {
  if (!canEdit.value) return;
  try {
    await api.patch(`/api/party-setup/parties/${party.id}`, {
      category: party.category,
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
    const res = await api.del<SetupResponse>(`/api/party-setup/parties/${party.id}`);
    applySetupResponse(res);
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
    const res = await api.patch<SetupResponse>(`/api/party-setup/parties/${party.id}/members`, { memberIds });
    applySetupResponse(res);
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
      await api.patch(`/api/party-setup/parties/${targetParty.id}/members/reorder`, { memberIds: newMembers.map((m) => m.id) });
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

function parseDraggedPartyId(event: DragEvent) {
  const customPayload = event.dataTransfer?.getData("text/party-id") ?? "";
  const customPartyId = Number.parseInt(customPayload, 10);
  if (Number.isInteger(customPartyId)) return customPartyId;

  const plainPayload = event.dataTransfer?.getData("text/plain") || event.dataTransfer?.getData("text") || "";
  const match = plainPayload.match(/^party:(\d+)$/);
  if (!match) return null;
  const partyIdRaw = match[1];
  if (!partyIdRaw) return null;
  const plainPartyId = Number.parseInt(partyIdRaw, 10);
  return Number.isInteger(plainPartyId) ? plainPartyId : null;
}

async function onDropToParty(event: DragEvent, party: Party) {
  if (!canEdit.value) return;
  event.preventDefault();

  const draggedPartyId = parseDraggedPartyId(event);
  if (draggedPartyId !== null) {
    partyDragWasHandled.value = true;
    if (draggedPartyId === party.id) return;
    await groupPartyToTarget(draggedPartyId, party);
    return;
  }
  
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

function onDragStartParty(event: DragEvent, party: Party) {
  if (!canEdit.value) return;
  partyDragSourcePartyId.value = party.id;
  partyDragSourceGroupId.value = party.groupId;
  partyDragWasHandled.value = false;
  event.dataTransfer?.setData("text/party-id", String(party.id));
  event.dataTransfer?.setData("text/plain", `party:${party.id}`);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

async function onDragEndParty() {
  const sourcePartyId = partyDragSourcePartyId.value;
  const sourceGroupId = partyDragSourceGroupId.value;
  const wasHandled = partyDragWasHandled.value;

  partyDragSourcePartyId.value = null;
  partyDragSourceGroupId.value = null;
  partyDragWasHandled.value = false;

  // Drag ended outside a valid party/group target: auto-ungroup grouped party.
  if (!canEdit.value || wasHandled || sourcePartyId === null || sourceGroupId === null) return;
  try {
    await assignPartyToGroup(sourcePartyId, null);
  } catch {
    if (!errorMsg.value) errorMsg.value = "Failed to ungroup party.";
  }
}

async function createGroup(name?: string, notes?: string | null) {
  if (!selectedEventId.value) return null;
  const res = await api.post<{ group: PartyGroup }>(`/api/party-setup/events/${selectedEventId.value}/groups`, {
    name,
    notes,
  });
  return res.group;
}

async function assignPartyToGroup(partyId: number, groupId: number | null) {
  try {
    const res = await api.patch<SetupResponse>(`/api/party-setup/parties/${partyId}/group`, { groupId });
    applySetupResponse(res);
  } catch (e: any) {
    const backendMessage = e?.data?.message;
    errorMsg.value = Array.isArray(backendMessage)
      ? backendMessage.join(", ")
      : (backendMessage || "Failed to assign party group.");
    throw e;
  }
}

async function groupPartyToTarget(sourcePartyId: number, targetParty: Party) {
  if (!canEdit.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    const sourceParty = parties.value.find((party) => party.id === sourcePartyId);
    if (!sourceParty) return;

    if (sourceParty.category !== targetParty.category) {
      errorMsg.value = "Only parties in the same category can be grouped.";
      return;
    }

    if (targetParty.groupId) {
      await assignPartyToGroup(sourcePartyId, targetParty.groupId);
      return;
    }

    const group = await createGroup(`${targetParty.name} Group`);
    if (!group) return;
    await assignPartyToGroup(targetParty.id, group.id);
    await assignPartyToGroup(sourcePartyId, group.id);
  } catch {
    if (!errorMsg.value) errorMsg.value = "Failed to group parties.";
    await onEventChange();
  } finally {
    busy.value = false;
  }
}

async function onDropToGroup(event: DragEvent, groupId: number) {
  if (!canEdit.value) return;
  event.preventDefault();
  const draggedPartyId = parseDraggedPartyId(event);
  if (draggedPartyId === null) return;
  partyDragWasHandled.value = true;

  busy.value = true;
  errorMsg.value = null;
  try {
    await assignPartyToGroup(draggedPartyId, groupId);
  } catch {
    if (!errorMsg.value) errorMsg.value = "Failed to add party to group.";
    await onEventChange();
  } finally {
    busy.value = false;
  }
}

async function saveGroupName(group: PartyGroup) {
  const name = editingGroupName.value.trim();
  if (!name) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    await api.patch(`/api/party-setup/groups/${group.id}`, { name });
    editingGroupId.value = null;
    await onEventChange();
  } catch {
    errorMsg.value = "Failed to save group name.";
  } finally {
    busy.value = false;
  }
}

async function saveGroupNotes(group: PartyGroup) {
  busy.value = true;
  errorMsg.value = null;
  try {
    await api.patch(`/api/party-setup/groups/${group.id}`, { notes: editingGroupNotes.value.trim() || null });
    editingGroupNotesId.value = null;
    await onEventChange();
  } catch {
    errorMsg.value = "Failed to save group notes.";
  } finally {
    busy.value = false;
  }
}

async function removeGroup(group: PartyGroup) {
  busy.value = true;
  errorMsg.value = null;
  try {
    const res = await api.del<SetupResponse>(`/api/party-setup/groups/${group.id}`);
    applySetupResponse(res);
  } catch {
    errorMsg.value = "Failed to delete group.";
  } finally {
    busy.value = false;
  }
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
        const rankedPlayer = sorted[index];
        if (rankedPlayer) {
          ranks.set(rankedPlayer.id, index + 1);
        }
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

const presetMenuItems = computed(() => {
  if (partyPresets.value.length === 0) {
    return [[{ label: "No presets available", disabled: true }]];
  }
  return [
    partyPresets.value.map((preset) => ({
      label: `${preset.name} (${preset.records.length})`,
      icon: "i-lucide-layout-template",
      onSelect: () => applyPreset(preset),
    })),
  ];
});

async function applyPreset(preset: PartyPreset) {
  if (!canEdit.value || !selectedEventId.value) return;
  busy.value = true;
  errorMsg.value = null;
  try {
    // Create the party using the preset name
    const { party: newParty } = await api.post<{ party: { id: number } }>(
      `/api/party-setup/events/${selectedEventId.value}/parties`,
      {
          name: preset.name,
          category: "Main",
        },
    );

    // Build set of already-assigned player ids (before this party)
    const alreadyAssigned = new Set(assignedPlayers.value);
    const pickedThisPreset = new Set<number>();

    const sortedRecords = [...preset.records].sort((a, b) => a.position - b.position);
    const memberIds: number[] = [];
    const unfilledLabels: string[] = [];

    for (const record of sortedRecords) {
      let candidates = rosterPlayers.value.filter((player) => {
        if (alreadyAssigned.has(player.id)) return false;
        if (pickedThisPreset.has(player.id)) return false;
        if (!player.snapshot) return false;
        if (player.snapshot.job !== record.job.name) return false;
        if (record.classRole && player.snapshot.classRole !== record.classRole.name) return false;
        return true;
      });

      if (record.classRank) {
        let statKey: "physical" | "magic" | "defensive";
        if (record.classRank === "PDMG") statKey = "physical";
        else if (record.classRank === "MDMG") statKey = "magic";
        else statKey = "defensive";
        candidates = [...candidates].sort(
          (a, b) => (b.classScores?.[statKey] ?? 0) - (a.classScores?.[statKey] ?? 0),
        );
      }

      const picked = candidates[0];
      if (picked) {
        pickedThisPreset.add(picked.id);
        memberIds.push(picked.id);
      } else {
        const label = record.classRole
          ? `${record.job.name} / ${record.classRole.name}`
          : record.job.name;
        unfilledLabels.push(label);
      }
    }

    if (memberIds.length > 0) {
      await api.patch(`/api/party-setup/parties/${newParty.id}/members`, { memberIds });
    }

    await fetchSetup(selectedEventId.value);

    if (unfilledLabels.length > 0) {
      toast.add({
        title: "Some slots could not be filled",
        description: `No match found for: ${unfilledLabels.join(", ")}`,
        color: "warning",
        icon: "i-lucide-triangle-alert",
        duration: 5000,
        ui: {
          title: 'text-white',
          description: 'text-white/90',
          icon: 'text-white',
          progress: 'bg-white/30',
        },
      });
    }
  } catch {
    errorMsg.value = "Failed to apply preset.";
  } finally {
    busy.value = false;
  }
}

async function fetchRefData() {
  try {
    const [jobsRes, rolesRes] = await Promise.all([
      api.get<RefJob[]>(`/api/ref-data/job-classes`),
      api.get<RefClassRole[]>(`/api/ref-data/class-roles`),
    ]);
    refJobs.value = jobsRes || [];
    refClassRoles.value = rolesRes || [];
  } catch {
    console.error("Failed to fetch ref data");
  }
}

function openSuggestionModal(party: Party, member: PartyMember) {
  if (!canEdit.value) return;
  suggestionMember.value = member;
  suggestionPartyId.value = party.id;
  
  // Pre-populate form if member already has a suggestion
  if (member.suggestion) {
    suggestionForm.jobId = member.suggestion.jobId;
    suggestionForm.classRoleId = member.suggestion.classRoleId;
  } else {
    suggestionForm.jobId = undefined;
    suggestionForm.classRoleId = undefined;
  }
  
  showSuggestionModal.value = true;
}

async function createMemberSuggestion() {
  if (!canEdit.value || !suggestionPartyId.value || !suggestionMember.value || !suggestionForm.jobId || !suggestionForm.classRoleId || !selectedEventId.value) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    await api.post(`/api/party-setup/parties/${suggestionPartyId.value}/members/${suggestionMember.value.id}/suggestion`, {
        jobId: suggestionForm.jobId,
        classRoleId: suggestionForm.classRoleId,
      },
    );

    showSuggestionModal.value = false;
    await fetchSetup(selectedEventId.value);
  } catch {
    errorMsg.value = "Failed to create suggestion.";
  } finally {
    busy.value = false;
  }
}

async function deleteMemberSuggestion() {
  if (!canEdit.value || !suggestionPartyId.value || !suggestionMember.value || !selectedEventId.value) return;

  busy.value = true;
  errorMsg.value = null;
  try {
    await api.del(`/api/party-setup/parties/${suggestionPartyId.value}/members/${suggestionMember.value.id}/suggestion`);

    showSuggestionModal.value = false;
    await fetchSetup(selectedEventId.value);
  } catch {
    errorMsg.value = "Failed to remove suggestion.";
  } finally {
    busy.value = false;
  }
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
      <UPopover v-model:open="eventPickerOpen" :content="{ align: 'start' }">
        <UButton
          color="neutral"
          variant="outline"
          class="w-full sm:w-72 justify-between"
        >
          <div class="min-w-0 text-left">
            <div class="truncate text-sm">{{ selectedEventLabel }}</div>
          </div>
          <UIcon name="i-lucide-chevron-down" class="h-4 w-4 text-slate-400" />
        </UButton>

        <template #content>
          <div class="w-[22rem] max-h-80 overflow-y-auto p-1">
            <button
              v-for="event in unexpiredVisibleEvents"
              :key="event.id"
              type="button"
              class="w-full rounded-md px-3 py-2 text-left transition-colors"
              :class="[
                selectedEventId === event.id ? 'bg-cyan-500/20' : 'hover:bg-slate-800',
                isEventExpired(event) ? 'text-rose-300' : 'text-slate-200',
              ]"
              @click="selectEventFromPicker(event.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ event.name }} ({{ event.partyCount }})</span>
                <span v-if="!event.publishedAt" class="shrink-0 text-[10px] uppercase tracking-wide text-amber-300">Draft</span>
              </div>
              <div class="mt-0.5 text-xs" :class="isEventExpired(event) ? 'text-rose-300/90' : 'text-slate-400'">
                {{ formatEventDate(event) }}
                <span v-if="isEventExpired(event)"> • Expired</span>
              </div>
            </button>

            <div v-if="canEdit" class="my-1 border-t border-slate-700"></div>

            <button
              v-if="canEdit && !includeExpired"
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm text-cyan-300 hover:bg-slate-800"
              @click="showExpiredEvents"
            >
              Show expired events
            </button>

            <button
              v-else-if="canEdit && includeExpired"
              type="button"
              class="w-full rounded-md px-3 py-2 text-left text-sm text-cyan-300 hover:bg-slate-800"
              @click="hideExpiredEvents"
            >
              Hide expired events
            </button>

            <button
              v-for="event in expiredVisibleEvents"
              :key="event.id"
              type="button"
              class="w-full rounded-md px-3 py-2 text-left transition-colors"
              :class="[
                selectedEventId === event.id ? 'bg-cyan-500/20' : 'hover:bg-slate-800',
                'text-rose-300',
              ]"
              @click="selectEventFromPicker(event.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-medium">{{ event.name }} ({{ event.partyCount }})</span>
                <span v-if="!event.publishedAt" class="shrink-0 text-[10px] uppercase tracking-wide text-amber-300">Draft</span>
              </div>
              <div class="mt-0.5 text-xs text-rose-300/90">
                {{ formatEventDate(event) }}
                <span> • Expired</span>
              </div>
            </button>
          </div>
        </template>
      </UPopover>

      <UButton
        v-if="canEdit"
        color="primary"
        variant="soft"
        icon="i-lucide-calendar-plus"
        @click="openNewEventModal()"
      >
        New Event
      </UButton>

    </div>

    <div v-if="selectedEvent && (selectedEvent.startsAt || selectedEvent.mainCommander || selectedEvent.subCommander)" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
      <span v-if="selectedEvent.startsAt" class="flex items-center gap-1">
        <UIcon name="i-lucide-calendar" class="h-3.5 w-3.5" />
        {{ new Date(selectedEvent.startsAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) }}
      </span>
      <span v-if="selectedEvent.mainCommander" class="flex items-center gap-1 text-amber-400/80">
        <UIcon name="i-lucide-shield" class="h-3.5 w-3.5" />
        Main: <span class="font-medium text-amber-400">{{ selectedEvent.mainCommander.ign }}</span>
      </span>
      <span v-if="selectedEvent.subCommander" class="flex items-center gap-1 text-slate-400">
        <UIcon name="i-lucide-shield" class="h-3.5 w-3.5" />
        Sub: <span class="font-medium text-slate-300">{{ selectedEvent.subCommander.ign }}</span>

          <div v-if="selectedEvent" class="flex flex-wrap items-center gap-2">
            <UBadge v-if="!selectedEvent.publishedAt" color="warning" variant="soft" size="sm">
              Draft
            </UBadge>
            <UBadge v-else color="success" variant="soft" size="sm">
              Published
            </UBadge>
            <UBadge v-if="selectedEvent.startsAt && new Date(selectedEvent.startsAt) < new Date()" color="error" variant="soft" size="sm">
              Expired
            </UBadge>
          </div>
      </span>
    </div>

    <UAlert v-if="errorMsg" color="error" variant="soft" :description="errorMsg" />

    <div v-if="loading" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="h-6 w-6 animate-spin text-slate-400" />
    </div>

    <div
      v-else
      class="grid gap-4"
      :class="canEdit ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'"
    >
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-white">Parties</h2>
          <div class="flex items-center gap-2">
            <UButton
              v-if="canEdit && selectedEventId && parties.length > 0"
              color="neutral"
              variant="outline"
              icon="i-lucide-printer"
              @click="showPreviewModal = true"
            >
              Preview
            </UButton>

            <template v-if="canEdit && selectedEventId && selectedEvent">
              <UButton
                v-if="!selectedEvent.publishedAt"
                color="success"
                variant="soft"
                icon="i-lucide-eye"
                :loading="busy"
                @click="publishCurrentEvent"
              >
                Publish
              </UButton>
              <UButton
                v-else
                color="warning"
                variant="soft"
                icon="i-lucide-eye-off"
                :loading="busy"
                @click="unpublishCurrentEvent"
              >
                Unpublish
              </UButton>
            </template>

            <UButton
              v-if="canEdit && selectedEventId"
              color="neutral"
              variant="outline"
              icon="i-lucide-pencil"
              @click="openEditEventModal"
            >
              Edit Event
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

            <UButton
              v-if="canEdit && discordWebhookAvailable && selectedEventId && parties.length > 0"
              color="neutral"
              variant="outline"
              :icon="discordPosted ? 'i-lucide-check' : 'i-simple-icons-discord'"
              :loading="discordPosting"
              @click="postToDiscord"
            >
              {{ discordPosted ? 'Posted!' : 'Post to Discord' }}
            </UButton>
            <!-- Admin: split button with preset dropdown -->
          <div v-if="auth.role === 'Admin' && selectedEventId" class="flex">
            <UButton
              class="rounded-r-none"
              color="primary"
              variant="solid"
              icon="i-lucide-plus"
              :loading="busy"
              @click="showCreatePartyModal = true"
            >
              Create Party
            </UButton>
            <UDropdownMenu :items="presetMenuItems" :content="{ align: 'end' }">
              <UButton
                class="rounded-l-none border-l border-white/20 px-2"
                color="primary"
                variant="solid"
                icon="i-lucide-chevron-down"
                :loading="busy"
              />
            </UDropdownMenu>
          </div>
          <!-- Officer: plain button -->
          <UButton
            v-else-if="canEdit && selectedEventId"
            color="primary"
            variant="solid"
            icon="i-lucide-plus"
            :loading="busy"
            @click="showCreatePartyModal = true"
          >
            Create Party
          </UButton>
          </div>
        </div>

        <div v-if="loadingSetup" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          Loading setup...
        </div>

        <div v-else-if="!selectedEventId" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          <template v-if="canEdit">No event yet. Create one to start.</template>
          <template v-else-if="events.length === 0">No published events yet.</template>
          <template v-else>Select an event above to view its party setup.</template>
        </div>

        <div v-else-if="parties.length === 0" class="rounded-lg border border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          No parties in this event yet.
        </div>

        <div v-else class="space-y-4">
          <div v-for="category in (['Main', 'Sub'] as const)" :key="category">
            <div v-if="parties.some(p => p.category === category)" class="space-y-2">
              <div class="flex items-center gap-2">
                <p class="text-xs font-semibold uppercase tracking-widest" :class="category === 'Main' ? 'text-amber-400/70' : 'text-slate-500'">{{ category }}</p>
                <span v-if="category === 'Main' && selectedEvent?.mainCommander" class="flex items-center gap-1 text-xs text-amber-400/80">
                  <UIcon name="i-lucide-shield" class="h-3 w-3" />{{ selectedEvent.mainCommander.ign }}
                </span>
                <span v-if="category === 'Sub' && selectedEvent?.subCommander" class="flex items-center gap-1 text-xs text-slate-400">
                  <UIcon name="i-lucide-shield" class="h-3 w-3" />{{ selectedEvent.subCommander.ign }}
                </span>
              </div>
              <div class="space-y-4">
                <article
                  v-for="entry in groupedPartiesByCategory(category)"
                  :key="entry.group.id"
                  class="rounded-xl border border-cyan-500/55 bg-slate-950/40 p-3"
                  @dragover="onDragOverParty"
                  @drop="onDropToGroup($event, entry.group.id)"
                >
                  <div class="mb-2">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1 space-y-1">
                        <!-- Name field -->
                        <div v-if="canEdit && editingGroupId === entry.group.id" class="flex items-center gap-1">
                          <UInput
                            v-model="editingGroupName"
                            size="sm"
                            autofocus
                            class="flex-1"
                            @keyup.enter="saveGroupName(entry.group)"
                            @keyup.escape="editingGroupId = null"
                            @blur="saveGroupName(entry.group)"
                          />
                          <UButton size="xs" icon="i-lucide-check" :disabled="busy" @click="saveGroupName(entry.group)" />
                          <UButton size="xs" variant="ghost" icon="i-lucide-x" :disabled="busy" @click="editingGroupId = null" />
                        </div>
                        <p
                          v-else
                          class="truncate text-sm font-semibold text-cyan-100"
                          :class="canEdit ? 'cursor-pointer hover:text-white' : ''"
                          @click="startEditGroupName(entry.group)"
                        >
                          {{ entry.group.name }}
                        </p>
                        <!-- Notes field -->
                        <div v-if="canEdit && editingGroupNotesId === entry.group.id" class="flex items-start gap-1">
                          <UTextarea
                            v-model="editingGroupNotes"
                            :rows="2"
                            size="sm"
                            class="flex-1"
                            @keyup.escape="editingGroupNotesId = null"
                            @blur="saveGroupNotes(entry.group)"
                          />
                          <div class="flex flex-col gap-1">
                            <UButton size="xs" icon="i-lucide-check" :disabled="busy" @click="saveGroupNotes(entry.group)" />
                            <UButton size="xs" variant="ghost" icon="i-lucide-x" :disabled="busy" @click="editingGroupNotesId = null" />
                          </div>
                        </div>
                        <p
                          v-else-if="entry.group.notes"
                          class="mt-1 text-xs text-rose-300"
                          :class="canEdit ? 'cursor-pointer hover:text-rose-200' : ''"
                          @click="startEditGroupNotes(entry.group)"
                        >
                          {{ entry.group.notes }}
                        </p>
                        <button
                          v-else-if="canEdit"
                          type="button"
                          class="mt-1 text-xs text-slate-500 hover:text-slate-300"
                          @click="startEditGroupNotes(entry.group)"
                        >
                          Add group notes…
                        </button>
                      </div>
                      <UButton
                        v-if="canEdit"
                        color="error"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-trash-2"
                        :disabled="busy"
                        @click="requestDeleteGroup(entry.group)"
                      />
                    </div>
                  </div>
                  <div class="flex flex-wrap items-start gap-3">
                    <PartyCard
                      v-for="party in entry.parties"
                      :key="party.id"
                      :party="party"
                      :can-edit="canEdit"
                      :busy="busy"
                      :actor-id="actorId"
                      :is-dragging-member="isDraggingMember"
                      :hovered-drop-zone="hoveredDropZone"
                      :party-category-options="partyCategoryOptions"
                      :class-ranks-by-player-id="classRanksByPlayerId"
                      @update:hovered-drop-zone="hoveredDropZone = $event"
                      @rename="onPartyRename"
                      @change-category="onPartyChangeCategory"
                      @change-note="onPartyChangeNote"
                      @delete-party="requestDeleteParty"
                      @remove-from-party="removeFromParty"
                      @suggest-class="openSuggestionModal"
                      @open-progression="openProgressionForMember"
                      @drag-over-party="onDragOverParty"
                      @drop-to-party="onDropToParty"
                      @drag-over-member-zone="onDragOverMemberZone"
                      @drag-leave-member-zone="onDragLeaveMemberZone"
                      @drag-start-member="onDragStartMember"
                      @drag-end-member="isDraggingMember = false; hoveredDropZone = null"
                      @drag-start-party="onDragStartParty"
                      @drag-end-party="onDragEndParty"
                      @drop-member-reorder="onDropMemberReorder"
                    />
                  </div>
                </article>

                <div class="flex flex-wrap items-start gap-3">
                  <PartyCard
                    v-for="party in ungroupedPartiesByCategory(category)"
                    :key="party.id"
                    :party="party"
                    :can-edit="canEdit"
                    :busy="busy"
                    :actor-id="actorId"
                    :is-dragging-member="isDraggingMember"
                    :hovered-drop-zone="hoveredDropZone"
                    :party-category-options="partyCategoryOptions"
                    :class-ranks-by-player-id="classRanksByPlayerId"
                    @update:hovered-drop-zone="hoveredDropZone = $event"
                    @rename="onPartyRename"
                    @change-category="onPartyChangeCategory"
                    @change-note="onPartyChangeNote"
                    @delete-party="requestDeleteParty"
                    @remove-from-party="removeFromParty"
                    @suggest-class="openSuggestionModal"
                    @open-progression="openProgressionForMember"
                    @drag-over-party="onDragOverParty"
                    @drop-to-party="onDropToParty"
                    @drag-over-member-zone="onDragOverMemberZone"
                    @drag-leave-member-zone="onDragLeaveMemberZone"
                    @drag-start-member="onDragStartMember"
                    @drag-end-member="isDraggingMember = false; hoveredDropZone = null"
                    @drag-start-party="onDragStartParty"
                    @drag-end-party="onDragEndParty"
                    @drop-member-reorder="onDropMemberReorder"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside
        v-if="canEdit"
        class="rounded-xl border border-slate-800 bg-slate-950/60 p-3 lg:sticky lg:top-4 lg:self-start"
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
          <div
            v-for="player in filteredRosterPlayers"
            :key="player.id"
            class="rounded-lg border border-slate-700 overflow-hidden"
            :class="player.id === actorId ? '' : (assignedPlayers.has(player.id) ? 'opacity-60' : '')"
          >
            <PlayerMiniCard
              :player="player"
              :actor-id="actorId"
              :ranks="classRanksByPlayerId"
              :draggable="canEdit && !assignedPlayers.has(player.id)"
              :can-suggest="false"
              @open-progression="openProgressionForRosterPlayer(player)"
              @dragstart="onDragStartPlayer($event, player.id)"
            />
          </div>
        </div>
      </aside>
    </div>
  </div>

  <UModal v-model:open="showEventModal">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">{{ eventModalMode === 'create' ? 'Create Event' : 'Edit Event' }}</span>
        </template>

        <div class="space-y-3">
          <UFormField label="Event Name" required>
            <UInput v-model="eventForm.name" placeholder="WoE Saturday" class="w-full" />
          </UFormField>
          <UFormField label="Event Type">
            <UInput v-model="eventForm.eventType" placeholder="WoE" class="w-full" />
          </UFormField>
          <UFormField label="Event Date">
            <UInput v-model="eventForm.startsAt" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Main Commander">
            <USelect
              v-model:model-value="eventForm.mainCommanderPlayerId"
              :items="commanderOptions"
              value-key="value"
              label-key="label"
              class="w-full"
              clearable
              searchable
              nullable
            />
          </UFormField>
          <UFormField label="Sub Commander">
            <USelect
              v-model:model-value="eventForm.subCommanderPlayerId"
              :items="commanderOptions"
              value-key="value"
              label-key="label"
              class="w-full"
              clearable
              searchable
              nullable
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="showEventModal = false">Cancel</UButton>
            <UButton color="primary" :loading="busy" @click="saveEvent">{{ eventModalMode === 'create' ? 'Create' : 'Save' }}</UButton>
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

  <UModal v-model:open="confirmDeletePartyOpen">
    <template #content>
      <UCard class="border border-rose-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Delete Party</span>
        </template>
        <div class="space-y-2">
          <p class="text-sm text-slate-200">
            Are you sure you want to delete
            <span class="font-semibold text-white">{{ partyToDelete?.name }}</span>?
          </p>
          <p class="text-sm text-rose-300">This action cannot be undone.</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="confirmDeletePartyOpen = false; partyToDelete = null">Cancel</UButton>
            <UButton color="error" :loading="busy" @click="confirmDeleteParty">Delete</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="confirmDeleteGroupOpen">
    <template #content>
      <UCard class="border border-rose-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Delete Group</span>
        </template>
        <div class="space-y-2">
          <p class="text-sm text-slate-200">
            Are you sure you want to delete
            <span class="font-semibold text-white">{{ groupToDelete?.name }}</span>?
          </p>
          <p class="text-sm text-rose-300">Parties in this group will be ungrouped.</p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="confirmDeleteGroupOpen = false; groupToDelete = null">Cancel</UButton>
            <UButton color="error" :loading="busy" @click="confirmDeleteGroup">Delete</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-if="canEdit" v-model:open="showPreviewModal" fullscreen>
    <template #content>
      <div class="h-screen w-screen overflow-hidden bg-white">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p class="text-sm font-semibold text-slate-900">Party Preview</p>
          <div class="flex items-center gap-2">
            <UButton
              color="neutral"
              variant="outline"
              :icon="previewLinkCopied ? 'i-lucide-check' : 'i-lucide-link'"
              @click="copyPreviewLink"
            >
              {{ previewLinkCopied ? 'Copied!' : 'Copy Link' }}
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-x"
              @click="showPreviewModal = false"
            >
              Close
            </UButton>
          </div>
        </div>
        <iframe
          v-if="previewUrl"
          :src="previewUrl"
          class="h-[calc(100vh-57px)] w-full border-0 bg-white"
          title="Party setup print preview"
        />
      </div>
    </template>
  </UModal>

  <!-- Suggestion Modal -->
  <UModal v-model:open="showSuggestionModal">
    <template #content>
      <UCard class="border border-amber-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Suggest Job Class for {{ suggestionMember?.ign }}</span>
        </template>

        <div class="space-y-3">
          <div v-if="suggestionMember?.snapshot" class="rounded bg-slate-900/50 p-3">
            <p class="text-xs text-slate-400">Current:</p>
            <p class="text-sm font-medium text-slate-100">{{ suggestionMember.snapshot.job }} / {{ suggestionMember.snapshot.classRole }}</p>
          </div>

          <UFormField label="Job Class" required>
            <USelect
              v-model:model-value="suggestionForm.jobId"
              :items="refJobs.map(j => ({ label: j.name, value: j.id }))"
              value-key="value"
              label-key="label"
              class="w-full"
              searchable
              clearable
              nullable
              placeholder="Select a job class"
            />
          </UFormField>

          <UFormField label="Class Role" required>
            <USelect
              v-model:model-value="suggestionForm.classRoleId"
              :items="refClassRoles.map(r => ({ label: r.name, value: r.id }))"
              value-key="value"
              label-key="label"
              class="w-full"
              searchable
              clearable
              nullable
              placeholder="Select a class role"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              v-if="suggestionMember?.suggestion"
              color="error"
              variant="soft"
              :loading="busy"
              @click="deleteMemberSuggestion"
            >
              Remove Suggestion
            </UButton>
            <UButton color="neutral" variant="soft" :disabled="busy" @click="showSuggestionModal = false">Cancel</UButton>
            <UButton
              color="warning"
              :loading="busy"
              :disabled="!suggestionForm.jobId || !suggestionForm.classRoleId"
              @click="createMemberSuggestion"
            >
              {{ suggestionMember?.suggestion ? 'Update' : 'Suggest' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <Teleport to="body">
    <PlayerProgressionModal
      v-if="progressionPlayer"
      :player-id="progressionPlayer.id"
      :player-string-id="progressionPlayer.playerStringId"
      :ign="progressionPlayer.ign"
      @close="progressionPlayer = null"
    />
  </Teleport>
</template>
