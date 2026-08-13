<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const api = useApi();
const config = useRuntimeConfig();
const shareToken = String(route.params.eventId ?? "");

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
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    mainCommander: { ign: string; playerId: string } | null;
    subCommander: { ign: string; playerId: string } | null;
  };
  parties: Party[];
  groups: PartyGroup[];
}

const loading = ref(true);
const errorMsg = ref<string | null>(null);
const event = ref<SetupResponse["event"] | null>(null);
const parties = ref<Party[]>([]);
const groups = ref<PartyGroup[]>([]);

useHead({
  title: computed(() => event.value?.name ? `${event.value.name} - Party Setup` : "Party Setup"),
  meta: [
    {
      name: "og:title",
      content: computed(() => event.value?.name ? `${event.value.name} - Party Setup` : "Party Setup"),
    },
    {
      name: "og:description",
      content: computed(() => {
        if (!event.value) return "Guild party setup";
        const mainCount = parties.value.filter((p) => p.category === "Main").length;
        const subCount = parties.value.filter((p) => p.category === "Sub").length;
        const totalMembers = parties.value.reduce((sum, p) => sum + p.members.length, 0);
        return `${event.value.name} • ${mainCount} Main + ${subCount} Sub • ${totalMembers} Members`;
      }),
    },
    {
      name: "og:type",
      content: "website",
    },
    {
      name: "og:url",
      content: computed(() => typeof window !== "undefined" ? window.location.href : ""),
    },
    {
      name: "og:image",
      content: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'%3E%3Crect fill='%236366f1' width='1200' height='630'/%3E%3Ctext x='50%25' y='50%25' font-size='72' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'%3EParty Setup%3C/text%3E%3C/svg%3E",
    },
    {
      name: "og:image:width",
      content: "1200",
    },
    {
      name: "og:image:height",
      content: "630",
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:image",
      content: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'%3E%3Crect fill='%236366f1' width='1200' height='630'/%3E%3Ctext x='50%25' y='50%25' font-size='72' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'%3EParty Setup%3C/text%3E%3C/svg%3E",
    },
  ],
});

onMounted(async () => {
  if (!shareToken) {
    errorMsg.value = "Invalid print link.";
    loading.value = false;
    return;
  }
  try {
    const res = await api.get<SetupResponse>(
      `/api/party-setup/public/events/${encodeURIComponent(shareToken)}`,
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

function memberSuggestionChanged(member: PartyMember) {
  if (!member.suggestion) return false;
  if (!member.snapshot) return true;
  return member.suggestion.job !== member.snapshot.job
    || member.suggestion.classRole !== member.snapshot.classRole;
}

function memberDisplayJob(member: PartyMember) {
  if (memberSuggestionChanged(member) && member.suggestion?.job) {
    return member.suggestion.job;
  }
  return member.snapshot?.job ?? null;
}

function shouldShowSuggestionIcon(member: PartyMember) {
  return memberSuggestionChanged(member);
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + (value.codePointAt(i) ?? 0)) % 2147483647;
  }
  return Math.abs(hash);
}

const JOB_PILL_PALETTE = [
  { bg: "#1e3a8a", text: "#dbeafe" },
  { bg: "#4c1d95", text: "#ede9fe" },
  { bg: "#7c2d12", text: "#ffedd5" },
  { bg: "#134e4a", text: "#ccfbf1" },
  { bg: "#831843", text: "#fce7f3" },
  { bg: "#3f3f46", text: "#f4f4f5" },
  { bg: "#0f766e", text: "#ccfbf1" },
  { bg: "#1d4ed8", text: "#dbeafe" },
  { bg: "#9a3412", text: "#ffedd5" },
  { bg: "#166534", text: "#dcfce7" },
  { bg: "#6b21a8", text: "#f3e8ff" },
  { bg: "#b91c1c", text: "#fee2e2" },
  { bg: "#0e7490", text: "#cffafe" },
  { bg: "#be185d", text: "#fce7f3" },
  { bg: "#4338ca", text: "#e0e7ff" },
  { bg: "#365314", text: "#ecfccb" },
  { bg: "#a16207", text: "#fef3c7" },
  { bg: "#374151", text: "#f3f4f6" },
  { bg: "#0369a1", text: "#e0f2fe" },
  { bg: "#047857", text: "#d1fae5" },
  { bg: "#7f1d1d", text: "#fee2e2" },
  { bg: "#701a75", text: "#fae8ff" },
  { bg: "#312e81", text: "#e0e7ff" },
  { bg: "#92400e", text: "#fef3c7" },
  { bg: "#14532d", text: "#dcfce7" },
  { bg: "#111827", text: "#f9fafb" },
];

function jobPillStyle(job: string) {
  const match = jobPaletteByName.value.get(job)
    ?? JOB_PILL_PALETTE[hashText(job) % JOB_PILL_PALETTE.length]
    ?? JOB_PILL_PALETTE[0];
  return {
    backgroundColor: match.bg,
    color: match.text,
    borderColor: match.bg,
  };
}

const jobPaletteByName = computed(() => {
  const jobs = Array.from(
    new Set(
      parties.value
        .flatMap((party) => party.members)
        .map((member) => member.snapshot?.job)
        .filter((job): job is string => Boolean(job)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const usedIndexes = new Set<number>();
  const map = new Map<string, { bg: string; text: string }>();

  for (const job of jobs) {
    const start = hashText(job) % JOB_PILL_PALETTE.length;
    let selected = start;

    // Prefer unique palette slots for the jobs visible in this preview.
    for (let step = 0; step < JOB_PILL_PALETTE.length; step += 1) {
      const idx = (start + step) % JOB_PILL_PALETTE.length;
      if (!usedIndexes.has(idx)) {
        selected = idx;
        usedIndexes.add(idx);
        break;
      }
    }

    map.set(job, JOB_PILL_PALETTE[selected] ?? JOB_PILL_PALETTE[0]);
  }

  return map;
});

const GROUP_PALETTE = [
  { border: "#1d4ed8", bg: "#eff6ff", heading: "#1e3a8a", noteBg: "#dbeafe" },
  { border: "#0f766e", bg: "#f0fdfa", heading: "#134e4a", noteBg: "#ccfbf1" },
  { border: "#a16207", bg: "#fffbeb", heading: "#713f12", noteBg: "#fef3c7" },
  { border: "#be185d", bg: "#fdf2f8", heading: "#831843", noteBg: "#fbcfe8" },
  { border: "#6d28d9", bg: "#f5f3ff", heading: "#4c1d95", noteBg: "#ddd6fe" },
  { border: "#b45309", bg: "#fff7ed", heading: "#7c2d12", noteBg: "#fed7aa" },
  { border: "#166534", bg: "#f0fdf4", heading: "#14532d", noteBg: "#dcfce7" },
  { border: "#0e7490", bg: "#ecfeff", heading: "#155e75", noteBg: "#cffafe" },
  { border: "#4338ca", bg: "#eef2ff", heading: "#3730a3", noteBg: "#e0e7ff" },
  { border: "#b91c1c", bg: "#fef2f2", heading: "#7f1d1d", noteBg: "#fee2e2" },
  { border: "#7e22ce", bg: "#faf5ff", heading: "#581c87", noteBg: "#f3e8ff" },
  { border: "#365314", bg: "#f7fee7", heading: "#3f6212", noteBg: "#ecfccb" },
  { border: "#9a3412", bg: "#fff7ed", heading: "#7c2d12", noteBg: "#ffedd5" },
  { border: "#1f2937", bg: "#f9fafb", heading: "#111827", noteBg: "#e5e7eb" },
  { border: "#0f172a", bg: "#f8fafc", heading: "#1e293b", noteBg: "#e2e8f0" },
  { border: "#0d9488", bg: "#f0fdfa", heading: "#115e59", noteBg: "#ccfbf1" },
  { border: "#4f46e5", bg: "#eef2ff", heading: "#312e81", noteBg: "#c7d2fe" },
  { border: "#ca8a04", bg: "#fefce8", heading: "#713f12", noteBg: "#fde68a" },
  { border: "#0369a1", bg: "#f0f9ff", heading: "#0c4a6e", noteBg: "#e0f2fe" },
  { border: "#047857", bg: "#ecfdf5", heading: "#065f46", noteBg: "#d1fae5" },
  { border: "#7f1d1d", bg: "#fef2f2", heading: "#7f1d1d", noteBg: "#fee2e2" },
  { border: "#701a75", bg: "#fdf4ff", heading: "#581c87", noteBg: "#fae8ff" },
  { border: "#312e81", bg: "#eef2ff", heading: "#312e81", noteBg: "#e0e7ff" },
  { border: "#92400e", bg: "#fffbeb", heading: "#78350f", noteBg: "#fef3c7" },
  { border: "#14532d", bg: "#f0fdf4", heading: "#14532d", noteBg: "#dcfce7" },
  { border: "#155e75", bg: "#ecfeff", heading: "#164e63", noteBg: "#cffafe" },
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
          <span v-if="event.startsAt">Event Date: {{ formatDate(event.startsAt) }}</span>
        </div>
      </div>

      <!-- Main row -->
      <div v-if="hasMainContent" class="category-section">
        <h2 class="category-label main">
          Main Battlefield
          <span v-if="event.mainCommander" class="commander-tag">
            <UIcon name="i-lucide-shield" class="commander-icon" />
            {{ event.mainCommander.ign }}
          </span>
        </h2>
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
                      <span class="member-name-wrap">
                        <span class="member-name">{{ member.ign }}</span>
                      </span>
                      <span
                        v-if="!shouldShowSuggestionIcon(member)"
                        class="job-pill"
                        :style="memberDisplayJob(member)
                          ? jobPillStyle(memberDisplayJob(member)!)
                          : undefined"
                      >
                        {{ memberDisplayJob(member) ?? "—" }}
                      </span>
                      <span
                        v-else
                        class="job-pill suggestion-job-pill"
                        :style="member.suggestion?.job
                          ? jobPillStyle(member.suggestion.job)
                          : undefined"
                        title="Suggested class change"
                      >
                        {{ member.suggestion?.job ?? memberDisplayJob(member) ?? "—" }}
                        <UIcon name="i-lucide-lightbulb" class="suggestion-icon" />
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
        <h2 class="category-label sub">
          Sub Battlefield
          <span v-if="event.subCommander" class="commander-tag commander-tag-sub">
            <UIcon name="i-lucide-shield" class="commander-icon" />
            {{ event.subCommander.ign }}
          </span>
        </h2>
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
                      <span class="member-name-wrap">
                        <span class="member-name">{{ member.ign }}</span>
                      </span>
                      <span
                        v-if="!shouldShowSuggestionIcon(member)"
                        class="job-pill"
                        :style="memberDisplayJob(member)
                          ? jobPillStyle(memberDisplayJob(member)!)
                          : undefined"
                      >
                        {{ memberDisplayJob(member) ?? "—" }}
                      </span>
                      <span
                        v-else
                        class="job-pill suggestion-job-pill"
                        :style="member.suggestion?.job
                          ? jobPillStyle(member.suggestion.job)
                          : undefined"
                        title="Suggested class change"
                      >
                        {{ member.suggestion?.job ?? memberDisplayJob(member) ?? "—" }}
                        <UIcon name="i-lucide-lightbulb" class="suggestion-icon" />
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

/* Category labels */
.category-label {
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.category-label.main { color: #b45309; }
.category-label.sub  { color: #475569; }

.commander-tag {
  font-size: 16px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  color: #b45309;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.commander-icon {
  width: 14px;
  height: 14px;
}
.commander-tag-sub {
  color: #64748b;
}

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
.members-table td.member-inline .member-name-wrap {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}
.members-table td.member-inline .member-name { font-weight: 700; }
.members-table td.member-inline .job-pill {
  border: 1px solid #94a3b8;
  background: #334155;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}
.members-table td.member-inline .suggestion-job-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.45);
}
.members-table td.member-inline .suggestion-icon {
  width: 12px;
  height: 12px;
}
.empty-row td { color: #cbd5e1; text-align: center; }

/* Print media */
@media print {
  .print-page { padding: 0; }
}
</style>
