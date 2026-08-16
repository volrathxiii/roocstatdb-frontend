<script setup lang="ts">
definePageMeta({ layout: false, middleware: "auth-required" });

const { auth, logout, fetchMe } = useAuth();
const { getLatestSnapshot } = useStatSnapshots();
const config = useRuntimeConfig();
const siteName = computed(() => config.public.siteName || "ROOC StatDB");
const roleLabel = computed(() => auth.value.role || "Applicant");
const hasStatRecord = ref(false);

onMounted(async () => {
  try {
    const latest = await getLatestSnapshot();
    hasStatRecord.value = latest.snapshot !== null;
  } catch {
    hasStatRecord.value = false;
  }
});

// Poll role-check (Public — does NOT reset the inactivity session window)
async function checkRole() {
  try {
    const res = await $fetch<{ role: string; isMember: boolean } | null>(
      `${config.public.backendUrl}/api/auth/role-check`,
      { credentials: 'include' },
    );
    if (res && (res.role !== auth.value.role || res.isMember !== auth.value.isMember)) {
      await fetchMe(); // full sync only when role actually changed
    }
  } catch { /* non-critical */ }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => { pollTimer = setInterval(checkRole, 10_000); });
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });

watch(() => auth.value.isMember, (isMember) => {
  if (isMember) navigateTo('/dashboard?welcome=1');
});
</script>

<template>
  <div class="min-h-screen p-6 md:p-10">
    <div class="mx-auto max-w-3xl space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl md:text-2xl font-semibold text-white">{{ siteName }}</h1>
          <p class="text-sm text-slate-400">Applicant portal</p>
        </div>
        <UButton color="neutral" variant="soft" icon="i-lucide-log-out" @click="logout">
          Logout
        </UButton>
      </div>

      <UCard class="border border-amber-900/40 bg-slate-950/70">
        <div class="space-y-4">
          <UBadge color="warning" variant="soft" size="lg">{{ roleLabel }}</UBadge>
          <h2 class="text-2xl font-semibold text-white">Welcome, {{ auth.player?.ign }}!</h2>
          <p class="text-slate-300">
            Player ID:
            <span class="font-medium text-amber-300">{{ auth.player?.playerId }}</span>
          </p>
          <UpdateIgnForm />
          <UAlert
            v-if="hasStatRecord"
            color="warning"
            variant="soft"
            icon="i-lucide-hourglass"
            title="Application in review"
            description="You are currently registered as an applicant. Contact an admin to complete membership approval."
          />
        </div>
      </UCard>

      <StatSnapshotForm v-if="auth.player?.playerId" :show-builds="false" />
    </div>
  </div>
</template>
