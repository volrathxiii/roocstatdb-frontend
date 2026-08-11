<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;
const { auth } = useAuth();

const eventId = Number(route.params.eventId);

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
    name: string;
    eventType: string | null;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
  };
  parties: Party[];
  groups: PartyGroup[];
}

const loading = ref(true);
const errorMsg = ref<string | null>(null);
const event = ref<SetupResponse["event"] | null>(null);
const parties = ref<Party[]>([]);
const groups = ref<PartyGroup[]>([]);

onMounted(async () => {
  if (!auth.value.player) {
    navigateTo("/login");
    return;
  }
  try {
    const res = await $fetch<SetupResponse>(
      `${backendUrl}/api/party-setup/events/${eventId}`,
      { query: { playerId: auth.value.player.playerId } },
    );
    event.value = res.event;
    parties.value = [...res.parties].sort((a, b) => a.position - b.position);
    groups.value = [...res.groups].sort((a, b) => a.position - b.position);
  } catch {
    errorMsg.value = "Failed to load event data.";
  } finally {
    loading.value = false;
  }
});

const partiesById = computed(() => {
  const map = new Map<number, Party>();
  for (const party of parties.value) {
    map.set(party.id, party);
  }
  return map;
});

function orderedPartiesByCategory(category: "Main" | "Sub") {
  const ordered: Party[] = [];
  const seen = new Set<number>();

  for (const group of groups.value) {
    const groupParties = group.partyIds
      .map((id) => partiesById.value.get(id))
      .filter((party): party is Party => party !== undefined && party.category === category)
      .sort((a, b) => a.position - b.position);
    for (const party of groupParties) {
      ordered.push(party);
      seen.add(party.id);
    }
  }

  const ungrouped = parties.value
    .filter((party) => party.category === category && !seen.has(party.id))
    .sort((a, b) => a.position - b.position);

  return [...ordered, ...ungrouped];
}

const mainOrderedParties = computed(() => orderedPartiesByCategory("Main"));
const subOrderedParties = computed(() => orderedPartiesByCategory("Sub"));

const groupsById = computed(() => {
  const map = new Map<number, PartyGroup>();
  for (const group of groups.value) {
    map.set(group.id, group);
  }
  return map;
});

const hasMainContent = computed(() => mainOrderedParties.value.length > 0);
const hasSubContent = computed(() => subOrderedParties.value.length > 0);

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function colorByText(value: string, palette: string[]) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + (value.codePointAt(i) ?? 0)) % 2147483647;
  }
  return palette[Math.abs(hash) % palette.length];
}

const JOB_PILL_PALETTE = [
  { bg: "#1e3a8a", text: "#dbeafe" },
  { bg: "#4c1d95", text: "#ede9fe" },
  { bg: "#7c2d12", text: "#ffedd5" },
  { bg: "#134e4a", text: "#ccfbf1" },
  { bg: "#831843", text: "#fce7f3" },
  { bg: "#3f3f46", text: "#f4f4f5" },
];

function jobPillStyle(job: string) {
  const bg = colorByText(job, JOB_PILL_PALETTE.map((item) => item.bg));
  const match = JOB_PILL_PALETTE.find((item) => item.bg === bg) ?? JOB_PILL_PALETTE[0];
  return {
    backgroundColor: match.bg,
    color: match.text,
    borderColor: match.bg,
  };
}

const GROUP_PALETTE = [
  { border: "#1d4ed8", bg: "#eff6ff", heading: "#1e3a8a", noteBg: "#dbeafe" },
  { border: "#0f766e", bg: "#f0fdfa", heading: "#134e4a", noteBg: "#ccfbf1" },
  { border: "#a16207", bg: "#fffbeb", heading: "#713f12", noteBg: "#fef3c7" },
  { border: "#be185d", bg: "#fdf2f8", heading: "#831843", noteBg: "#fbcfe8" },
  { border: "#6d28d9", bg: "#f5f3ff", heading: "#4c1d95", noteBg: "#ddd6fe" },
  { border: "#b45309", bg: "#fff7ed", heading: "#7c2d12", noteBg: "#fed7aa" },
];

function paletteForGroupId(groupId: number) {
  return GROUP_PALETTE[groupId % GROUP_PALETTE.length] ?? GROUP_PALETTE[0];
}

function groupStyle(group: PartyGroup) {
  const palette = paletteForGroupId(group.id);
  return {
    borderColor: palette.border,
    backgroundColor: palette.bg,
  };
}

function groupHeadingStyle(group: PartyGroup) {
  const palette = paletteForGroupId(group.id);
  return { color: palette.heading };
}

function groupNoteStyle(group: PartyGroup) {
  const palette = paletteForGroupId(group.id);
  return { backgroundColor: palette.noteBg };
}

function partyHeaderStyle(party: Party) {
  if (party.groupId === null) {
    return { backgroundColor: "#0f172a", color: "#f1f5f9" };
  }
  const group = groupsById.value.get(party.groupId);
  if (!group) {
    return { backgroundColor: "#0f172a", color: "#f1f5f9" };
  }
  const palette = paletteForGroupId(group.id);
  return { backgroundColor: palette.border, color: "#f8fafc" };
}

function groupLegendEntriesByCategory(category: "Main" | "Sub") {
  return groups.value
    .map((group) => {
      const linkedParties = group.partyIds
        .map((id) => partiesById.value.get(id))
        .filter((party): party is Party => party !== undefined && party.category === category)
        .sort((a, b) => a.position - b.position);
      return {
        group,
        linkedParties,
      };
    })
    .filter((entry) => entry.linkedParties.length > 0);
}

const mainGroupLegendEntries = computed(() => groupLegendEntriesByCategory("Main"));
const subGroupLegendEntries = computed(() => groupLegendEntriesByCategory("Sub"));
</script>

<template>
  <div class="print-page">
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="errorMsg" class="error">{{ errorMsg }}</div>
    <template v-else-if="event">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>{{ event.name }}</h1>
          <p v-if="event.eventType" class="event-type">{{ event.eventType }}</p>
        </div>
        <div class="meta">
          <span v-if="event.startsAt">{{ formatDate(event.startsAt) }}</span>
          <span class="status">{{ event.status }}</span>
        </div>
      </div>

      <!-- Main row -->
      <div v-if="hasMainContent" class="category-section">
        <h2 class="category-label main">Main Battlefield</h2>
        <div class="category-row">
        <aside v-if="mainGroupLegendEntries.length > 0" class="legend-panel">
          <h3>Groups</h3>
          <div v-for="entry in mainGroupLegendEntries" :key="`legend-main-${entry.group.id}`" class="legend-item">
            <div class="legend-meta">
              <p class="legend-pill" :style="{ backgroundColor: groupStyle(entry.group).borderColor }">{{ entry.group.name }}</p>
              <p v-if="entry.group.notes" class="legend-note">{{ entry.group.notes }}</p>
            </div>
          </div>
        </aside>
        <div class="category-content">
          <div class="parties-grid">
            <div v-for="party in mainOrderedParties" :key="party.id" class="party-card">
              <div class="party-header" :style="partyHeaderStyle(party)">
                <span class="party-name">{{ party.name }}</span>
                <span class="member-count">{{ party.members.length }}/5</span>
              </div>
              <div v-if="party.notes" class="party-notes">{{ party.notes }}</div>
              <table class="members-table">
                <tbody>
                  <tr v-for="member in party.members" :key="member.id">
                    <td class="member-inline">
                      <span class="member-name">{{ member.ign }}</span>
                      <span
                        class="job-pill"
                        :style="member.snapshot
                          ? jobPillStyle(member.snapshot.job)
                          : undefined"
                      >
                        {{ member.snapshot?.job ?? "—" }}
                      </span>
                    </td>
                  </tr>
                  <tr v-for="i in (5 - party.members.length)" :key="`empty-${i}`" class="empty-row">
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- Sub row -->
      <div v-if="hasSubContent" class="category-section">
        <h2 class="category-label sub">Sub Battlefield</h2>
        <div class="category-row">
        <aside v-if="subGroupLegendEntries.length > 0" class="legend-panel">
          <h3>Groups</h3>
          <div v-for="entry in subGroupLegendEntries" :key="`legend-sub-${entry.group.id}`" class="legend-item">
            <div class="legend-meta">
              <p class="legend-pill" :style="{ backgroundColor: groupStyle(entry.group).borderColor }">{{ entry.group.name }}</p>
              <p v-if="entry.group.notes" class="legend-note">{{ entry.group.notes }}</p>
            </div>
          </div>
        </aside>
        <div class="category-content">
          <div class="parties-grid">
            <div v-for="party in subOrderedParties" :key="party.id" class="party-card">
              <div class="party-header" :style="partyHeaderStyle(party)">
                <span class="party-name">{{ party.name }}</span>
                <span class="member-count">{{ party.members.length }}/5</span>
              </div>
              <div v-if="party.notes" class="party-notes">{{ party.notes }}</div>
              <table class="members-table">
                <tbody>
                  <tr v-for="member in party.members" :key="member.id">
                    <td class="member-inline">
                      <span class="member-name">{{ member.ign }}</span>
                      <span
                        class="job-pill"
                        :style="member.snapshot
                          ? jobPillStyle(member.snapshot.job)
                          : undefined"
                      >
                        {{ member.snapshot?.job ?? "—" }}
                      </span>
                    </td>
                  </tr>
                  <tr v-for="i in (5 - party.members.length)" :key="`empty-${i}`" class="empty-row">
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }

.print-page {
  font-family: system-ui, sans-serif;
  font-size: 12px;
  color: #0f172a;
  background: #fff;
  padding: 24px;
  min-height: 100vh;
  width: 100%;
}

.loading, .error {
  padding: 40px;
  text-align: center;
  color: #64748b;
}

/* Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 10px;
  margin-bottom: 18px;
}
.page-header h1 { font-size: 20px; font-weight: 700; }
.event-type { font-size: 11px; color: #64748b; margin-top: 2px; }
.meta { text-align: right; font-size: 11px; color: #475569; display: flex; flex-direction: column; gap: 3px; align-items: flex-end; }
.status { font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

/* Category labels */
.category-label {
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.category-label.main { color: #b45309; }
.category-label.sub  { color: #475569; }

.category-section {
  margin-bottom: 24px;
}

.category-section:last-child {
  margin-bottom: 0;
}

.category-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 14px;
  align-items: start;
  margin-top: 8px;
}

.category-content {
  min-width: 0;
}

.legend-panel {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px;
}

.legend-panel h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #334155;
  margin-bottom: 8px;
}

.legend-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border-top: 1px solid #e2e8f0;
  padding-top: 8px;
  margin-top: 8px;
}

.legend-item:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 0;
}

.legend-meta {
  min-width: 0;
}

.legend-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 3px 10px;
  color: #f8fafc;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.1;
}

.legend-count {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.legend-note {
  margin-top: 4px;
  font-size: 15px;
  color: #334155;
  white-space: pre-wrap;
}

.category-stack {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 10px;
}

.group-block {
  flex: 1 1 420px;
  min-width: 320px;
  border: 2px solid;
  border-radius: 10px;
  padding: 8px;
  page-break-inside: avoid;
}

.category-stack > .parties-grid {
  flex: 1 1 100%;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.group-name {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.group-notes {
  margin-bottom: 8px;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: #1e293b;
  font-style: italic;
}

.grouped-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  align-items: stretch;
  gap: 8px;
}

/* Party grid */
.parties-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  align-items: stretch;
  gap: 12px;
}

/* Party card */
.party-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  overflow: hidden;
  page-break-inside: avoid;
}

.party-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0f172a;
  color: #f1f5f9;
  padding: 6px 10px;
  font-weight: 600;
  font-size: 14px;
}
.member-count { font-size: 12px; opacity: 0.75; }

.party-notes {
  font-size: 12px;
  color: #b91c1c;
  padding: 5px 10px;
  border-bottom: 1px solid #fecaca;
  background: #fef2f2;
  font-style: italic;
}

/* Members table */
.members-table {
  width: 100%;
  flex: 1;
  border-collapse: collapse;
}
.members-table tr { border-bottom: 1px solid #f1f5f9; }
.members-table tr:last-child { border-bottom: none; }
.members-table td {
  padding: 5px 10px;
  vertical-align: middle;
  font-size: 13px;
}
.members-table td.member-inline {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.members-table td.member-inline .member-name { font-weight: 700; }
.members-table td.member-inline .job-pill {
  border: 1px solid #94a3b8;
  background: #334155;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}
.empty-row td { color: #cbd5e1; text-align: center; }

/* Print media */
@media print {
  .print-page { padding: 0; }
}
</style>
