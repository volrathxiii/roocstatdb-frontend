<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-content">
        <!-- Header -->
        <div class="modal-header">
          <h2 class="modal-title">{{ card.name }}</h2>
          <button @click="$emit('close')" class="close-btn">×</button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Card image -->
          <div class="card-display">
            <img
              :src="`/cards/${card.cardImageId}`"
              :alt="card.name"
              class="card-image-large"
            />
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Rarity:</span>
                <span class="value" :style="{ color: card.rarity.color, fontWeight: '600' }">
                  {{ card.rarity.displayName }}
                </span>
              </div>
              <div class="info-item">
                <span class="label">Slot:</span>
                <span class="value">{{ card.slot.name }}</span>
              </div>
              <div v-if="card.droppedBy" class="info-item">
                <span class="label">Dropped By:</span>
                <span class="value">{{ card.droppedBy }}</span>
              </div>
            </div>
          </div>

          <!-- Card effects -->
          <div class="effects-section">
            <div class="effect-item">
              <h4 class="effect-title">Card Effect</h4>
              <p class="effect-text">{{ card.cardEffect }}</p>
            </div>

            <div v-if="card.depositEffect" class="effect-item">
              <h4 class="effect-title">Deposit Effect</h4>
              <p class="effect-text">{{ card.depositEffect }}</p>
            </div>

            <div v-if="card.awakenEffect1" class="effect-item">
              <h4 class="effect-title">Awaken Effect 1</h4>
              <p class="effect-text">{{ card.awakenEffect1 }}</p>
            </div>

            <div v-if="card.awakenEffect2" class="effect-item">
              <h4 class="effect-title">Awaken Effect 2</h4>
              <p class="effect-text">{{ card.awakenEffect2 }}</p>
            </div>

            <div v-if="card.awakenEffect3" class="effect-item">
              <h4 class="effect-title">Awaken Effect 3</h4>
              <p class="effect-text">{{ card.awakenEffect3 }}</p>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button @click="$emit('close')" class="btn-cancel">Close</button>
          <button @click="addCard" :disabled="isAdding" class="btn-add">
            {{ isAdding ? "Adding..." : "Add to Inventory" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { RefCard } from "~/app/types/cards";

const props = defineProps<{
  card: RefCard;
}>();

const emit = defineEmits<{
  close: [];
  add: [cardId: number];
}>();

const isAdding = ref(false);

async function addCard() {
  isAdding.value = true;
  emit("add", props.card.id);
  isAdding.value = false;
}

// Close on Escape key
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      emit("close");
    }
  };
  window.addEventListener("keydown", handleKeydown);
  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
  });
});
</script>

<style scoped lang="postcss">
.modal-backdrop {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
}

.modal-content {
  @apply bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto;
}

.modal-header {
  @apply flex items-center justify-between p-4 border-b border-slate-200 sticky top-0 bg-white;
}

.modal-title {
  @apply text-xl font-bold text-slate-900;
}

.close-btn {
  @apply text-2xl text-slate-500 hover:text-slate-700 transition font-light leading-none;
}

.modal-body {
  @apply p-4 space-y-4;
}

.card-display {
  @apply flex gap-4 flex-col md:flex-row;
}

.card-image-large {
  @apply w-full md:w-48 aspect-square object-cover rounded-lg bg-slate-100;
}

.info-grid {
  @apply flex-1 space-y-2;
}

.info-item {
  @apply flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-200;
}

.label {
  @apply font-semibold text-slate-700;
}

.value {
  @apply text-slate-600;
}

.value.rarity-common {
  @apply text-slate-500 font-semibold;
}

.value.rarity-uncommon {
  @apply text-green-600 font-semibold;
}

.value.rarity-rare {
  @apply text-blue-600 font-semibold;
}

.value.rarity-epic {
  @apply text-purple-600 font-semibold;
}

.value.rarity-legendary {
  @apply text-yellow-600 font-semibold;
}

.value.rarity-special {
  @apply text-pink-600 font-semibold;
}

.effects-section {
  @apply space-y-3;
}

.effect-item {
  @apply border-l-4 border-blue-400 bg-blue-50 p-3 rounded;
}

.effect-title {
  @apply text-sm font-semibold text-slate-900 mb-1;
}

.effect-text {
  @apply text-sm text-slate-700 leading-relaxed;
}

.modal-footer {
  @apply flex gap-3 p-4 border-t border-slate-200 sticky bottom-0 bg-white justify-end;
}

.btn-cancel {
  @apply px-4 py-2 bg-slate-200 text-slate-900 rounded-md hover:bg-slate-300 transition font-medium;
}

.btn-add {
  @apply px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition font-medium disabled:bg-slate-300 disabled:cursor-not-allowed;
}
</style>
