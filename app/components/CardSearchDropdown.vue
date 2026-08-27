<template>
  <div class="card-search-container">
    <input
      ref="inputRef"
      v-model="searchQuery"
      type="text"
      placeholder="Search cards…"
      data-card-search-input
      class="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
      @focus="showDropdown = true"
      @blur="handleBlur"
    />
    
    <!-- Dropdown Results - Teleported to avoid modal overflow clipping -->
    <Teleport to="body">
      <div
        v-if="showDropdown && inputRef"
        class="fixed z-50 w-72 rounded-lg border border-slate-700 bg-slate-800 shadow-xl overflow-hidden"
        :style="dropdownStyle"
      >
        <!-- Show dropdown only if there's a search query -->
        <template v-if="searchQuery.trim()">
          <!-- Loading State -->
          <div v-if="loading" class="dropdown-item loading">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-slate-400" />
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="dropdown-item error">
            {{ error }}
          </div>

          <!-- No Results -->
          <div v-else-if="filteredCards.length === 0" class="dropdown-item no-results">
            No cards found
          </div>

          <!-- Results Section -->
          <template v-else>
            <div class="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 bg-slate-900/60">Cards</div>
            <button
              v-for="card in filteredCards"
              :key="card.id"
              type="button"
              class="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-700 transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed border-0 bg-transparent"
              @mousedown.prevent="addCard(card)"
              :disabled="addingCardId === card.id"
            >
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <img :src="`/cards/${card.cardImageId}`" :alt="card.name" class="w-8 h-8 rounded object-cover flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-white truncate">{{ card.name }}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs px-1.5 py-0.5 rounded-sm" :style="{ backgroundColor: card.rarity.color }">
                      {{ card.rarity.displayName }}
                    </span>
                    <span class="text-xs text-slate-400">{{ card.slot.name }}</span>
                  </div>
                </div>
              </div>
              <span class="text-xs text-indigo-400 flex-shrink-0">{{ addingCardId === card.id ? "..." : "Add" }}</span>
            </button>
          </template>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core";
import { nextTick } from "vue";
import type { RefCard } from "~/app/types/cards";

const { addCardToInventory } = useCards();
const api = useApi();

const inputRef = ref<HTMLInputElement | null>(null);
const searchQuery = ref("");
const showDropdown = ref(false);
const filteredCards = ref<RefCard[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const addingCardId = ref<number | null>(null);

// Compute dropdown position based on input element
const dropdownStyle = computed(() => {
  if (!inputRef.value) return { top: "0", right: "0" };
  const rect = inputRef.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
  };
});

const emit = defineEmits<{
  cardAdded: [card: RefCard];
}>();

// Debounced server-side search
const debouncedSearch = useDebounceFn(async () => {
  if (!searchQuery.value.trim()) {
    filteredCards.value = [];
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    // Backend automatically filters by ALLOWED_CARD_RARITIES
    // Just pass the search query
    const response = await api.get(`/api/cards?search=${encodeURIComponent(searchQuery.value.trim())}`);
    filteredCards.value = response.slice(0, 10); // Limit to 10 results
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to search cards";
    filteredCards.value = [];
  } finally {
    loading.value = false;
  }
}, 300);

watch(searchQuery, () => {
  debouncedSearch();
});

async function addCard(card: RefCard) {
  try {
    addingCardId.value = card.id;
    await addCardToInventory(card.id, 1);
    emit("cardAdded", card);
    searchQuery.value = ""; // Clear search after adding
    // Keep dropdown open for searching more cards
    if (inputRef.value) {
      nextTick(() => inputRef.value?.focus());
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to add card";
  } finally {
    addingCardId.value = null;
  }
}

function handleBlur() {
  // Delay closing dropdown to allow click on card button
  globalThis.setTimeout(() => {
    showDropdown.value = false;
  }, 200);
}
</script>

<style scoped lang="postcss">
.card-search-container {
  @apply relative w-full;
}

.dropdown-item {
  @apply px-4 py-3 flex items-center justify-center text-white;
}

.dropdown-item.loading,
.dropdown-item.no-results,
.dropdown-item.error {
  @apply justify-center text-center text-slate-400;
}

.dropdown-item.error {
  @apply text-red-400;
}
</style>
