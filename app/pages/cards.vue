<template>
  <div class="cards-page">
    <CardGrid />
  </div>
</template>

<script setup lang="ts">
// Require authentication
definePageMeta({
  layout: "authenticated",
  middleware: "auth",
});

const { setSubtitle } = usePageSubtitle();

onMounted(() => {
  setSubtitle("Card Collection");
});
</script>

<style scoped lang="postcss">
.cards-page {
  @apply flex flex-col gap-4;
}
</style>
