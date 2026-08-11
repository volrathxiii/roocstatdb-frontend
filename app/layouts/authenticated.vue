<script setup lang="ts">
const { auth, logout } = useAuth();
const config = useRuntimeConfig();
const { subtitle } = usePageSubtitle();
const siteName = computed(() => config.public.siteName || "OUROBOROS");
const backendUrl = config.public.backendUrl;

const isPrivileged = computed(() =>
  auth.value.role === "Officer" || auth.value.role === "Admin"
);

const applicantStatsCount = ref(0);
const rosterMissingStatsCount = ref(0);

async function fetchApplicantStatsCount() {
  try {
    const res = await $fetch<{ count: number }>(`${backendUrl}/api/players/applicant-stats-count`);
    applicantStatsCount.value = res.count;
  } catch {
    // non-critical — badge simply stays at 0
  }
}

async function fetchRosterMissingStatsCount() {
  try {
    const res = await $fetch<{ count: number }>(`${backendUrl}/api/players/members-missing-stats-count`);
    rosterMissingStatsCount.value = res.count;
  } catch {
    // non-critical — badge simply stays at 0
  }
}

const navItems = computed(() => [
  { label: "Dashboard",  icon: "i-lucide-layout-dashboard",  to: "/dashboard",  badge: 0, badgeClass: "bg-sky-500", badgeTooltip: "" },
  ...(auth.value.role !== "Applicant" && auth.value.role !== "Waitlisted"
    ? [{ label: "Rosters", icon: "i-lucide-users", to: "/rosters", badge: rosterMissingStatsCount.value, badgeClass: "bg-red-500", badgeTooltip: "Members missing this week's stats" }]
    : []),
  ...(isPrivileged.value
    ? [{ label: "Applicants", icon: "i-lucide-user-plus", to: "/applicants", badge: applicantStatsCount.value, badgeClass: "bg-sky-500", badgeTooltip: "Applicant stat submissions this week" }]
    : []),
  ...(auth.value.role === "Admin"
    ? [{ label: "Management", icon: "i-lucide-settings", to: "/management", badge: 0, badgeClass: "bg-sky-500", badgeTooltip: "" }]
    : []),
]);

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.value.player) navigateTo("/login");
  fetchApplicantStatsCount();
  fetchRosterMissingStatsCount();
});
</script>

<template>
  <div class="flex min-h-screen flex-col">

    <!-- Top header (full width) -->
    <header class="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div>
        <h1 class="text-xl md:text-2xl font-semibold text-white">{{ siteName }}</h1>
          <p class="text-sm text-slate-400">{{ subtitle }}</p>
      </div>
      <UButton color="neutral" variant="soft" icon="i-lucide-log-out" @click="logout">
        Logout
      </UButton>
    </header>

    <!-- Body: sidebar + main -->
    <div class="flex flex-1">

      <!-- Left sidebar (all authenticated users) -->
      <aside
        class="flex w-16 flex-col items-center gap-4 border-r border-slate-800 bg-transparent py-6"
      >
        <UTooltip v-for="item in navItems" :key="item.to" :text="item.label" :popper="{ placement: 'right' }">
          <div class="relative">
            <UButton
              :to="item.to"
              :icon="item.icon"
              color="neutral"
              variant="ghost"
              size="lg"
              square
            />
            <UTooltip v-if="item.badge > 0 && item.badgeTooltip" :text="item.badgeTooltip" :popper="{ placement: 'right' }">
              <span
                :class="['absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold text-white', item.badgeClass]"
              >{{ item.badge }}</span>
            </UTooltip>
            <span
              v-else-if="item.badge > 0"
              :class="['absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold text-white', item.badgeClass]"
            >{{ item.badge }}</span>
          </div>
        </UTooltip>
      </aside>

      <!-- Main content -->
      <main class="flex-1 p-6 md:p-10">
        <slot />
      </main>

    </div>
  </div>
</template>
