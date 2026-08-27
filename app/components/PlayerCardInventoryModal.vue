<script setup lang="ts">
import type { PlayerCardInventory } from "~/types/cards";
import CardSearchDropdown from "./CardSearchDropdown.vue";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const api = useApi();
const cards = useCards();
const { rarities, fetchRarities } = useCardRarities();

const inventory = ref<PlayerCardInventory[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showQuantityModal = ref(false);
const selectedCard = ref<PlayerCardInventory | null>(null);
const confirmDeleteOpen = ref(false);
const cardToDelete = ref<PlayerCardInventory | null>(null);

// Fetch player's inventory
const fetchInventory = async () => {
  try {
    loading.value = true;
    error.value = null;
    inventory.value = await cards.getMyInventory();
    if (rarities.value.length === 0) {
      await fetchRarities();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load inventory";
  } finally {
    loading.value = false;
  }
};

// Load data when modal opens
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await fetchInventory();
    }
  },
  { flush: "post" }
);

// Handle card added from search dropdown
const handleCardAdded = async () => {
  await fetchInventory();
};

// Close modal on Escape key, unless search input is focused
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    // Check if the search input is focused
    const searchInput = document.querySelector("[data-card-search-input]") as HTMLInputElement;
    if (searchInput && document.activeElement === searchInput) {
      // Search is focused, let it handle escape (clear search)
      return;
    }
    // Search not focused, close modal
    event.preventDefault();
    emit("close");
  }
};

// Add keyboard listener when modal opens
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.removeEventListener("keydown", handleKeyDown);
    }
  }
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeyDown);
});

// Edit card quantity
const editCardQuantity = (cardItem: PlayerCardInventory) => {
  selectedCard.value = cardItem;
  showQuantityModal.value = true;
};

// Handle updating quantity
const handleUpdateQuantity = async (newQuantity: number) => {
  if (!selectedCard.value) return;

  try {
    await cards.updateCardQuantity(selectedCard.value.cardId, newQuantity);
    await fetchInventory();
    showQuantityModal.value = false;
    selectedCard.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to update card quantity";
  }
};

// Remove card from inventory
const requestDeleteCard = (cardItem: PlayerCardInventory) => {
  cardToDelete.value = cardItem;
  confirmDeleteOpen.value = true;
};

const cancelDeleteCard = () => {
  confirmDeleteOpen.value = false;
  cardToDelete.value = null;
};

const confirmDeleteCard = async () => {
  if (!cardToDelete.value) return;

  try {
    await cards.removeCardFromInventory(cardToDelete.value.cardId);
    await fetchInventory();
    confirmDeleteOpen.value = false;
    cardToDelete.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to remove card";
  }
};
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="$emit('close')"
      ></div>

      <!-- Modal -->
      <div class="relative bg-slate-900 rounded-lg shadow-lg border border-slate-700 w-full max-w-5xl mx-4 h-[90vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center px-6 py-4 border-b border-slate-700 gap-4 flex-shrink-0">
          <h2 class="text-lg font-semibold text-white">My Card Album</h2>
          
          <div class="ml-auto w-64">
            <!-- Card Search Dropdown -->
            <CardSearchDropdown @card-added="handleCardAdded" />
          </div>

          <button
            @click="$emit('close')"
            class="text-slate-400 hover:text-slate-200 flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <!-- Error message -->
          <div v-if="error" class="rounded-md bg-red-500/10 border border-red-500/30 p-3 mb-4">
            <p class="text-sm text-red-400">{{ error }}</p>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="text-center py-8 text-slate-400">
            Loading inventory...
          </div>

          <!-- Empty state -->
          <div v-else-if="inventory.length === 0" class="text-center py-12 text-slate-400">
            <p class="mb-2">No cards in your inventory</p>
            <p class="text-sm">Start searching for cards to add</p>
          </div>

          <!-- Cards grid -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div
              v-for="item in inventory"
              :key="item.id"
              class="group rounded-lg border border-slate-700 bg-slate-800 overflow-hidden hover:border-slate-600 transition"
            >
              <!-- Card image -->
              <div class="relative aspect-square overflow-hidden bg-slate-900">
                <img
                  :src="`/cards/${item.card.cardImageId}`"
                  :alt="item.card.name"
                  class="w-full h-full object-cover"
                />

                <!-- Rarity badge -->
                <div
                  class="absolute top-1 right-1 px-2 py-1 text-xs font-bold rounded text-white"
                  :style="{ backgroundColor: item.card.rarity.color }"
                >
                  {{ item.card.rarity.displayName }}
                </div>

                <!-- Quantity badge -->
                <div class="absolute bottom-1 left-1 px-2 py-1 text-xs font-bold rounded bg-blue-500 text-white">
                  x{{ item.quantity }}
                </div>
              </div>

              <!-- Card info -->
              <div class="p-3 space-y-2">
                <p class="font-medium text-white truncate">{{ item.card.name }}</p>

                <!-- Action buttons -->
                <div class="flex gap-2">
                  <button
                    @click="editCardQuantity(item)"
                    class="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 transition"
                  >
                    ✎ Edit
                  </button>
                  <button
                    @click="requestDeleteCard(item)"
                    class="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 transition"
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Quantity modal for editing -->
  <CardQuantityModal
    :is-open="showQuantityModal"
    :card-name="selectedCard?.card.name"
    :initial-quantity="selectedCard?.quantity"
    @close="showQuantityModal = false"
    @confirm="handleUpdateQuantity"
  />

  <!-- Delete confirmation modal (teleport to body for proper z-index stacking) -->
  <Teleport to="body">
    <div v-if="confirmDeleteOpen" class="fixed inset-0 z-[999] flex items-center justify-center">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="cancelDeleteCard"
      ></div>

      <!-- Modal -->
      <div class="relative bg-slate-950 rounded-lg shadow-2xl border border-rose-900/40 w-full max-w-sm mx-4 z-[1000]">
        <div class="p-6 space-y-4">
          <h3 class="text-lg font-semibold text-white">Remove Card</h3>

          <div class="space-y-2">
            <p class="text-sm text-slate-200">
              Are you sure you want to remove this card from your inventory?
            </p>
            <p class="text-sm text-rose-300">
              This action cannot be undone.
            </p>
            <p v-if="cardToDelete" class="text-xs text-slate-400">
              Card: {{ cardToDelete.card.name }}
            </p>
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button
              @click="cancelDeleteCard"
              class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition"
            >
              Cancel
            </button>
            <button
              @click="confirmDeleteCard"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
