<template>
  <div class="relative inline-block">
    <button
      ref="buttonRef"
      class="relative p-2 text-slate-400 hover:text-white transition-colors"
      :class="{ 'opacity-50 cursor-wait': loading }"
      :disabled="loading"
      @click="isOpen = !isOpen"
    >
      <UIcon name="i-lucide-album" class="w-5 h-5" />
      <!-- Badge -->
      <span
        v-if="cardCount > 0"
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-bold text-white bg-sky-500"
      >
        {{ cardCount }}
      </span>
    </button>

    <!-- Dropdown popover -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed z-50"
        :style="dropdownStyle"
      >
        <div class="w-72 rounded-lg p-3 bg-slate-800 border border-slate-700 shadow-xl">
          <!-- Loading State -->
          <div v-if="loading" class="flex items-center justify-center py-8">
            <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-slate-400" />
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-red-400 text-sm py-4">
            {{ error }}
          </div>

          <!-- Empty State -->
          <div v-else-if="cards.length === 0" class="text-slate-400 text-sm py-4 text-center">
            No cards in album
          </div>

          <!-- Cards List -->
          <template v-else>
            <div class="text-xs font-semibold uppercase tracking-widest text-slate-500 pb-2 mb-3 border-b border-slate-700">
              Cards ({{ cardCount }})
            </div>
            <div class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="card in cards"
                :key="card.card.id"
                class="flex items-center justify-between p-2 rounded hover:bg-slate-700/50 transition-colors"
              >
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <img
                    :src="`/cards/${card.card.cardImageId}`"
                    :alt="card.card.name"
                    class="w-6 h-6 rounded object-cover flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white truncate">{{ card.card.name }}</div>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span
                        class="text-xs px-1 py-0.5 rounded-sm"
                        :style="{ backgroundColor: card.card.rarity.color }"
                      >
                        {{ card.card.rarity.displayName }}
                      </span>
                    </div>
                  </div>
                </div>
                <span class="text-xs text-slate-400 flex-shrink-0 ml-2">×{{ card.quantity }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Click outside to close -->
      <div
        v-if="isOpen"
        class="fixed inset-0"
        @click="isOpen = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { PlayerCardInventory } from "~/app/types/cards";

interface Props {
  playerId?: number;
}

const props = defineProps<Props>();

const { getMyInventory } = useCards();
const api = useApi();

const cards = ref<PlayerCardInventory[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const isOpen = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);

const cardCount = computed(() => {
  return cards.value.reduce((sum, card) => sum + card.quantity, 0);
});

// Dropdown positioning
const dropdownStyle = computed(() => {
  if (!buttonRef.value || !isOpen.value) return { top: "0", left: "0" };
  const rect = buttonRef.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  };
});

async function loadCards() {
  try {
    loading.value = true;
    error.value = null;

    // If playerId is provided, fetch that player's cards, otherwise get current user's
    if (props.playerId) {
      cards.value = await api.get<PlayerCardInventory[]>(
        `/api/players/${props.playerId}/cards`
      );
    } else {
      cards.value = await getMyInventory();
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to load cards";
  } finally {
    loading.value = false;
  }
}

// Load cards on demand when popover is about to open
function loadCardsIfNeeded() {
  if (cards.value.length === 0 && !loading.value) {
    loadCards();
  }
}

// Load cards on component mount
onMounted(() => {
  loadCardsIfNeeded();
});

// Reload when playerId changes
watch(() => props.playerId, () => {
  cards.value = [];
  loadCardsIfNeeded();
});
</script>

<style scoped lang="postcss">
/* Allow scrolling inside popover without affecting page */
</style>
