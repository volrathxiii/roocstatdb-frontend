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
  <div class="space-y-6 max-w-2xl">
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

    <StatSnapshotForm v-if="auth.player?.playerId" :player-id="auth.player.playerId" />
  </div>
</template>
