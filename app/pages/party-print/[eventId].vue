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
  position: number;
  members: PartyMember[];
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
}

const loading = ref(true);
const errorMsg = ref<string | null>(null);
const event = ref<SetupResponse["event"] | null>(null);
const parties = ref<Party[]>([]);

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
  } catch {
    errorMsg.value = "Failed to load event data.";
  } finally {
    loading.value = false;
  }
});

const mainParties = computed(() => parties.value.filter((p) => p.category === "Main"));
const subParties = computed(() => parties.value.filter((p) => p.category === "Sub"));

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

      <!-- Main parties -->
      <template v-if="mainParties.length">
        <h2 class="category-label main">Main</h2>
        <div class="parties-grid">
          <div v-for="party in mainParties" :key="party.id" class="party-card">
            <div class="party-header">
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
      </template>

      <!-- Sub parties -->
      <template v-if="subParties.length">
        <h2 class="category-label sub">Sub</h2>
        <div class="parties-grid">
          <div v-for="party in subParties" :key="party.id" class="party-card">
            <div class="party-header">
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
      </template>

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
.category-label.sub  { color: #475569; margin-top: 18px; }

/* Party grid */
.parties-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

/* Party card */
.party-card {
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
  .parties-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
