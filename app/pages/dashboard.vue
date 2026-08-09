<script setup lang="ts">
definePageMeta({ layout: false });

const { auth, logout } = useAuth();

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.value.player) navigateTo("/login");
});
</script>

<template>
  <div class="min-h-screen p-6 md:p-10">
    <div class="mx-auto max-w-3xl space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl md:text-2xl font-semibold text-white">ROOC StatDB</h1>
          <p class="text-sm text-slate-400">Member portal</p>
        </div>
        <UButton color="neutral" variant="soft" icon="i-lucide-log-out" @click="logout">
          Logout
        </UButton>
      </div>

      <UCard class="border border-cyan-900/40 bg-slate-950/70">
        <div class="space-y-4">
          <UBadge color="primary" variant="soft" size="lg">Member Access</UBadge>
          <h2 class="text-2xl font-semibold text-white">Welcome, {{ auth.player?.ign }}!</h2>
          <p class="text-slate-300">
            Player ID:
            <span class="font-medium text-cyan-300">{{ auth.player?.playerId }}</span>
          </p>
          <p class="text-slate-400">Your membership is active. Dashboard modules can be added here.</p>
        </div>
      </UCard>
    </div>
  </div>
</template>
