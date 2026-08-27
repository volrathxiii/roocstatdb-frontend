<template>
  <div class="card-grid-container">
    <!-- Header with search and filters -->
    <div class="grid-header">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search cards by name..."
          @input="debouncedSearch"
          class="search-input"
        />
      </div>

      <div class="filters">
        <select v-model.number="selectedRarity" @change="debouncedSearch" class="filter-select">
          <option :value="undefined">All Rarities</option>
          <option value="1">Common</option>
          <option value="2">Uncommon</option>
          <option value="3">Rare</option>
          <option value="4">Epic</option>
          <option value="5">Legendary</option>
          <option value="6">Special</option>
        </select>

        <select v-model.number="selectedSlot" @change="debouncedSearch" class="filter-select">
          <option :value="undefined">All Slots</option>
          <option value="1">Armor</option>
          <option value="2">Weapon</option>
          <option value="3">Accessory</option>
          <option value="4">Garment</option>
          <option value="5">Headgear</option>
          <option value="6">Shoes</option>
          <option value="7">Shield</option>
          <option value="8">Mouthgear</option>
          <option value="9">Backgear</option>
        </select>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <p>Loading cards...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p>Failed to load cards: {{ error }}</p>
      <button @click="loadCards" class="retry-btn">Retry</button>
    </div>

    <!-- Card grid -->
    <div v-else class="grid">
      <div
        v-for="card in displayedCards"
        :key="card.id"
        class="card-item"
        :class="{ owned: ownedCardIds.has(card.id) }"
      >
        <!-- Card image -->
        <div class="card-image-wrapper">
          <img
            :src="`/cards/${card.cardImageId}`"
            :alt="card.name"
            class="card-image"
            @error="onImageError"
          />
          <div 
            class="rarity-badge" 
            :style="{ backgroundColor: card.rarity.color }"
          >
            {{ card.rarity.displayName }}
          </div>
          <div v-if="ownedCardIds.has(card.id)" class="owned-badge">✓</div>
        </div>

        <!-- Card name and info -->
        <div class="card-info">
          <h3 class="card-name">{{ card.name }}</h3>
          <p class="card-slot">{{ card.slot.name }}</p>
        </div>

        <!-- Quick add button -->
        <button
          @click="() => addCard(card.id)"
          :disabled="addingCardId === card.id"
          class="add-btn"
        >
          {{ addingCardId === card.id ? "Adding..." : "Add" }}
        </button>

        <!-- View details link -->
        <button
          @click="() => selectCard(card)"
          class="details-btn"
        >
          Details
        </button>
      </div>
    </div>

    <!-- No results state -->
    <div v-if="!loading && !error && filteredCards.length === 0" class="no-results">
      <p>No cards found matching your filters</p>
    </div>

    <!-- Results count -->
    <div v-if="!loading && !error" class="results-count">
      Showing {{ displayedCards.length }} of {{ filteredCards.length }} cards
    </div>

    <!-- Load more button -->
    <div v-if="!loading && hasMore" class="load-more-container">
      <button @click="loadMore" class="load-more-btn">
        Load More Cards
      </button>
    </div>

    <!-- Card detail modal -->
    <CardDetailModal
      v-if="selectedCardDetail"
      :card="selectedCardDetail"
      @close="selectedCardDetail = null"
      @add="onDetailAdd"
    />
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import type { RefCard } from "~/app/types/cards";
import CardDetailModal from "./CardDetailModal.vue";

const { getAllCards, getMyInventory, addCardToInventory } = useCards();

const allCards = ref<RefCard[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const searchQuery = ref("");
const selectedRarity = ref<number | undefined>();
const selectedSlot = ref<number | undefined>();
const addingCardId = ref<number | null>(null);
const ownedCardIds = ref<Set<number>>(new Set());
const selectedCardDetail = ref<RefCard | null>(null);
const displayCount = ref(40); // Show 40 cards at a time

// Debounced search - reset display count when filters change
const debouncedSearch = useDebounceFn(() => {
  displayCount.value = 40; // Reset to first page when searching
}, 300);

const filteredCards = computed(() => {
  return allCards.value.filter((card) => {
    // Apply rarity filter
    if (selectedRarity.value && card.rarityId !== selectedRarity.value) {
      return false;
    }
    // Apply slot filter
    if (selectedSlot.value && card.slotId !== selectedSlot.value) {
      return false;
    }
    // Apply search filter
    if (searchQuery.value && !card.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      return false;
    }
    return true;
  });
});

// Only display the first N cards (for pagination)
const displayedCards = computed(() => {
  return filteredCards.value.slice(0, displayCount.value);
});

const hasMore = computed(() => {
  return displayCount.value < filteredCards.value.length;
});

async function loadCards() {
  try {
    loading.value = true;
    error.value = null;

    // Load all cards and user's inventory in parallel
    const [cards, inventory] = await Promise.all([
      getAllCards(),
      getMyInventory().catch(() => []), // Don't fail if user isn't logged in
    ]);

    allCards.value = cards;
    ownedCardIds.value = new Set(inventory.map((pc) => pc.cardId));
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Unknown error";
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  displayCount.value += 40; // Load 40 more cards
}

async function addCard(cardId: number) {
  try {
    addingCardId.value = cardId;
    await addCardToInventory(cardId, 1);
    ownedCardIds.value.add(cardId);
  } catch (err) {
    // Error handled by composable - could show a toast notification
  } finally {
    addingCardId.value = null;
  }
}

function selectCard(card: RefCard) {
  selectedCardDetail.value = card;
}

async function onDetailAdd(cardId: number) {
  await addCard(cardId);
  // Keep the modal open - user can add multiple times
}

function onImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = "/cards/card_default.webp";
}

onMounted(() => {
  loadCards();
});
</script>

<style scoped lang="postcss">
.card-grid-container {
  @apply flex flex-col gap-4 p-4;
}

.grid-header {
  @apply flex flex-col gap-3 md:flex-row md:items-center md:gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200;
}

.search-bar {
  @apply flex-1;
}

.search-input {
  @apply w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500;
}

.filters {
  @apply flex gap-2 md:w-auto;
}

.filter-select {
  @apply px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm;
}

.loading-state,
.error-state,
.no-results {
  @apply flex items-center justify-center py-12 text-center;
}

.loading-state p,
.no-results p {
  @apply text-slate-600;
}

.error-state {
  @apply flex-col gap-3;
}

.error-state p {
  @apply text-red-600;
}

.retry-btn {
  @apply px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition;
}

.grid {
  @apply grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6;
}

.card-item {
  @apply flex flex-col gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:shadow-md transition overflow-hidden;
}

.card-item.owned {
  @apply border-green-300 bg-green-50;
}

.card-image-wrapper {
  @apply relative aspect-square overflow-hidden rounded-md bg-slate-100;
}

.card-image {
  @apply w-full h-full object-cover;
}

.rarity-badge {
  @apply absolute top-1 right-1 px-2 py-1 text-xs font-bold rounded text-white;
}

.rarity-common {
  @apply bg-slate-500;
}

.rarity-uncommon {
  @apply bg-green-500;
}

.rarity-rare {
  @apply bg-blue-500;
}

.rarity-epic {
  @apply bg-purple-500;
}

.rarity-legendary {
  @apply bg-yellow-600;
}

.rarity-special {
  @apply bg-pink-500;
}

.owned-badge {
  @apply absolute bottom-1 right-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold;
}

.card-info {
  @apply flex-1;
}

.card-name {
  @apply text-sm font-semibold text-slate-900 line-clamp-2;
}

.card-slot {
  @apply text-xs text-slate-500;
}

.add-btn,
.details-btn {
  @apply px-2 py-1 text-xs font-medium rounded transition;
}

.add-btn {
  @apply bg-blue-500 text-white hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed;
}

.details-btn {
  @apply bg-slate-200 text-slate-900 hover:bg-slate-300;
}

.results-count {
  @apply text-center text-sm text-slate-600 mt-4;
}

.load-more-container {
  @apply flex justify-center mt-6 pb-4;
}

.load-more-btn {
  @apply px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition;
}

.results-count {
  @apply text-xs text-slate-500 text-center pt-2;
}
</style>
