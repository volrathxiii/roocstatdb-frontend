<script setup lang="ts">
const { auth } = useAuth();
const api = useApi();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();

definePageMeta({
  layout: "authenticated",
  middleware: "auth",
});

interface DashboardStatusResponse {
  player: {
    id: number;
    ign: string;
    playerId: string;
    role: string | null;
    isMember: boolean;
    snapshot: {
      weekNumber: number;
      year: number;
      job: string;
      classRole: string;
    } | null;
  };
  assignments: Array<{
    id: number;
    position: number;
    joinedAt: string;
    event: {
      id: number;
      shareToken: string;
      name: string;
      eventType: string | null;
      startsAt: string | null;
      commander: { ign: string; playerId: string } | null;
    };
    party: {
      id: number;
      name: string;
      category: "Main" | "Sub";
      notes: string | null;
      memberCount: number;
      group: { id: number; name: string; notes: string | null } | null;
      members: Array<{
        position: number;
        player: {
          id: number;
          ign: string;
          playerId: string;
          role: string | null;
          isCurrentPlayer: boolean;
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
        };
      }>;
    };
    suggestion: {
      job: string;
      jobId: number;
      classRole: string;
      classRoleId: number;
    } | null;
  }>;
}

const loadingAssignments = ref(false);
const assignmentsError = ref<string | null>(null);
const dashboardStatus = ref<DashboardStatusResponse | null>(null);

function formatEventDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function jobTextClass(job?: string | null) {
  if (!job) return "text-slate-500";
  const colors = ["text-violet-300", "text-sky-300", "text-amber-300", "text-rose-300", "text-emerald-300", "text-orange-300"];
  let hash = 0;
  for (let i = 0; i < job.length; i++) {
    hash = (hash << 5) - hash + job.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function memberJob(member: DashboardStatusResponse["assignments"][number]["party"]["members"][number]["player"]) {
  return member.suggestion?.job ?? member.snapshot?.job ?? null;
}

function memberClassLabel(member: DashboardStatusResponse["assignments"][number]["party"]["members"][number]["player"]) {
  const job = member.suggestion?.job ?? member.snapshot?.job;
  const classRole = member.suggestion?.classRole ?? member.snapshot?.classRole;
  if (!job || !classRole) return "Unknown";
  return `${job} - ${classRole}`;
}

const sortedAssignments = computed(() => {
  const list = dashboardStatus.value?.assignments ?? [];
  return [...list].sort((a, b) => {
    const aTs = a.event.startsAt ? new Date(a.event.startsAt).getTime() : null;
    const bTs = b.event.startsAt ? new Date(b.event.startsAt).getTime() : null;
    if (aTs !== null && bTs !== null) return aTs - bTs;
    if (aTs !== null) return -1;
    if (bTs !== null) return 1;
    return 0;
  });
});

onMounted(() => {
  setSubtitle("Member portal");

  const run = async () => {
    if (!auth.value.player?.playerId) return;
    loadingAssignments.value = true;
    assignmentsError.value = null;
    try {
      dashboardStatus.value = await api.get<DashboardStatusResponse>(
        `/api/players/status`,
      );
    } catch {
      assignmentsError.value = "Failed to load party assignment details.";
    } finally {
      loadingAssignments.value = false;
    }
  };

  void run();
});
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-3">
    <div class="space-y-6 xl:col-span-1">
      <UCard class="border border-cyan-900/40 bg-slate-950/70">
        <div class="space-y-4">
          <UBadge color="primary" variant="soft" size="lg">{{ auth.role ?? "Member" }} Access</UBadge>
          <h2 class="text-2xl font-semibold text-white">Welcome, {{ auth.player?.ign }}!</h2>
          <p class="text-slate-300">
            Player ID:
            <span class="font-medium text-cyan-300">{{ auth.player?.playerId }}</span>
          </p>

          <UpdateIgnForm class="pt-2" />
        </div>
      </UCard>

      <StatSnapshotForm v-if="auth.player?.playerId" />
    </div>

    <div class="space-y-3 xl:col-span-1">
      <div class="flex items-center justify-between">
        <h3 class="text-xl font-semibold text-white">Party Assignments</h3>
        <UBadge color="neutral" variant="soft">{{ sortedAssignments.length }}</UBadge>
      </div>

      <p v-if="loadingAssignments" class="text-sm text-slate-400">Loading party details...</p>
      <p v-else-if="assignmentsError" class="text-sm text-rose-300">{{ assignmentsError }}</p>
      <p v-else-if="sortedAssignments.length === 0" class="text-sm text-slate-400">
        You are not assigned to any party yet.
      </p>

      <div v-else class="space-y-3">
        <article
          v-for="assignment in sortedAssignments"
          :key="assignment.id"
          class="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60"
        >
            <div class="p-3">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-lg font-semibold text-white">{{ assignment.event.name }}</p>
                <span
                  class="rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                  :class="assignment.party.category === 'Main' ? 'border-amber-500/50 bg-amber-900/30 text-amber-300' : 'border-slate-600 bg-slate-800 text-slate-300'"
                >
                  {{ assignment.party.category }}
                </span>
                <span v-if="assignment.event.eventType" class="text-sm text-slate-400">
                  {{ assignment.event.eventType }}
                </span>
              </div>

              <p v-if="assignment.event.startsAt" class="mt-1 text-sm text-slate-400">
                Event Date: {{ formatEventDate(assignment.event.startsAt) }}
              </p>

              <div class="mt-2 grid gap-1 text-base text-slate-300">
                <p v-if="assignment.party.group">
                  Group: <span class="font-medium text-slate-100">{{ assignment.party.group.name }}</span>
                </p>
                <p v-if="assignment.party.group?.notes" class="text-sm text-rose-300">
                  Group Notes: {{ assignment.party.group.notes }}
                </p>
                <p v-if="assignment.event.commander">
                  Commander:
                  <span class="font-medium" :class="assignment.party.category === 'Main' ? 'text-amber-400' : 'text-slate-200'">
                    {{ assignment.event.commander.ign }}
                  </span>
                </p>
              </div>
            </div>

            <div class="overflow-hidden border-y border-slate-800 bg-slate-950/70">
              <div class="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                <p class="text-sm font-semibold uppercase tracking-wide text-slate-200">{{ assignment.party.name }}</p>
                <span class="text-sm text-slate-400">{{ assignment.party.memberCount }}/5</span>
              </div>
              <table class="w-full table-fixed">
                <tbody>
                  <tr
                    v-for="member in assignment.party.members"
                    :key="`${assignment.id}-${member.player.id}`"
                    class="border-b border-slate-800/70 last:border-b-0"
                  >
                    <td class="px-3 py-2">
                      <div class="flex items-center justify-between gap-3">
                        <p :class="['text-sm', member.player.isCurrentPlayer ? 'font-semibold text-cyan-300' : 'text-slate-300']">
                          {{ member.player.ign }}
                          <span v-if="member.player.isCurrentPlayer" class="text-cyan-400">(You)</span>
                        </p>
                        <span
                          class="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold"
                          :class="jobTextClass(memberJob(member.player))"
                        >
                          {{ memberClassLabel(member.player) }}
                          <UIcon v-if="member.player.suggestion" name="i-lucide-lightbulb" class="h-3.5 w-3.5 text-amber-300" />
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="p-3 text-sm">
              <p v-if="assignment.party.notes" class="text-rose-300">
                Party Notes: {{ assignment.party.notes }}
              </p>
              <p v-if="!assignment.party.notes" class="text-slate-400">
                No notes.
              </p>
            </div>
        </article>
      </div>
    </div>
  </div>
</template>
