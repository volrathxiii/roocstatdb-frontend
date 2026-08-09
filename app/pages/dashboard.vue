<script setup lang="ts">
const { auth } = useAuth();
const { setSubtitle } = usePageSubtitle();

definePageMeta({
  layout: "authenticated",
});

onMounted(() => {
  setSubtitle("Member portal");
});
</script>

<template>
  <UCard class="border border-cyan-900/40 bg-slate-950/70">
    <div class="space-y-4">
      <UBadge color="primary" variant="soft" size="lg">{{ auth.role ?? "Member" }} Access</UBadge>
      <h2 class="text-2xl font-semibold text-white">Welcome, {{ auth.player?.ign }}!</h2>
      <p class="text-slate-300">
        Player ID:
        <span class="font-medium text-cyan-300">{{ auth.player?.playerId }}</span>
      </p>
      <p class="text-slate-400">Your membership is active. Dashboard modules can be added here.</p>
    </div>
  </UCard>
</template>
