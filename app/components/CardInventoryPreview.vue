<template>
  <div class="card-inventory-preview">
    <!-- Loading state -->
    <div v-if="loading" class="loading-container">
      <p class="text-slate-400">Loading cards...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-container">
      <p class="text-red-400">{{ error }}</p>
      <button @click="loadInventory" class="retry-btn">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="inventory.length === 0" class="empty-container">
      <p class="text-slate-400 mb-3">You haven't collected any cards yet.</p>
      <NuxtLink
        to="/cards"
        class="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
      >
        Start Collecting →
      </NuxtLink>
    </div>

    <!-- Cards grid (showing first 12) -->
    <div v-else>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <div
          v-for="item in displayedCards"
          :key="item.cardId"
          class="card-preview"
          @click="selectCard(item.card)"
        >
          <div class="card-image-wrapper">
            <img
              :src="`/cards/${item.card.cardImageId}`"
              :alt="item.card.name"
              class="card-image"
            />
            <div class="quantity-badge">{{ item.quantity }}</div>
            <div class="rarity-badge" :style="{ backgroundColor: item.card.rarity.color }">
              {{ item.card.rarity.displayName }}
            </div>
          </div>
          <p class="card-name">{{ item.card.name }}</p>
        </div>
      </div>

      <!-- Show more link if inventory exceeds 12 -->
      <div v-if="inventory.length > 12" class="mt-4 text-center">
        <p class="text-sm text-slate-400 mb-2">
          Showing {{ displayedCards.length }} of {{ inventory.length }} cards
        </p>
        <NuxtLink
          to="/cards"
          class="text-sm text-cyan-400 hover:text-cyan-300 transition font-medium"
        >
          View your full collection →
        </NuxtLink>
      </div>
    </div>

    <!-- Card detail modal -->
    <CardDetailModal
      v-if="selectedCard"
      :card="selectedCard"
      @close="selectedCard = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { PlayerCardInventory, RefCard } from "~/app/types/cards";
import CardDetailModal from "./CardDetailModal.vue";

const { getMyInventory } = useCards();

const loading = ref(true);
const error = ref<string | null>(null);
const inventory = ref<PlayerCardInventory[]>([]);
const selectedCard = ref<RefCard | null>(null);

const displayedCards = computed(() => inventory.value.slice(0, 12));

async function loadInventory() {
  try {
    loading.value = true;
    error.value = null;
    inventory.value = await getMyInventory();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load inventory";
  } finally {
    loading.value = false;
  }
}

function selectCard(card: RefCard) {
  selectedCard.value = card;
}

onMounted(() => {
  loadInventory();
});
</script>

<style scoped lang="postcss">
.card-inventory-preview {
  @apply bg-slate-900/60 border border-slate-800 rounded-lg p-4;
}

.loading-container,
.error-container,
.empty-container {
  @apply py-8 text-center;
}

.error-container {
  @apply flex flex-col items-center gap-3;
}

.retry-btn {
  @apply px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition;
}

.empty-container {
  @apply text-slate-400;
}

.card-preview {
  @apply cursor-pointer group;
}

.card-image-wrapper {
  @apply relative aspect-square overflow-hidden rounded-md bg-slate-800 border border-slate-700 hover:border-slate-500 transition;
}

.card-image {
  @apply w-full h-full object-cover group-hover:scale-105 transition;
}

.quantity-badge {
  @apply absolute bottom-1 left-1 px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full;
}

.rarity-badge {
  @apply absolute top-1 right-1 px-1.5 py-0.5 text-xs font-bold rounded text-white text-center;
}

.rarity-common {
  @apply bg-slate-500;
}

.rarity-uncommon {
  @apply bg-green-600;
}

.rarity-rare {
  @apply bg-blue-600;
}

.rarity-epic {
  @apply bg-purple-600;
}

.rarity-legendary {
  @apply bg-yellow-600;
}

.rarity-special {
  @apply bg-pink-600;
}

.card-name {
  @apply text-xs font-semibold text-slate-300 line-clamp-1 mt-1 group-hover:text-slate-100 transition;
}
</style>
