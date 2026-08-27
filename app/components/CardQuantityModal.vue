<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  cardName?: string;
  initialQuantity?: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [quantity: number];
}>();

const quantity = ref(1);

watch(
  () => props.initialQuantity,
  (val) => {
    quantity.value = val ?? 1;
  }
);

const handleConfirm = () => {
  if (quantity.value > 0) {
    emit("confirm", quantity.value);
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
      <div class="relative bg-slate-900 rounded-lg shadow-lg border border-slate-700 p-6 w-full max-w-sm mx-4 space-y-4">
        <h2 class="text-lg font-semibold text-white">Card Quantity</h2>

        <p v-if="cardName" class="text-sm text-slate-400">
          Card: <span class="font-medium text-white">{{ cardName }}</span>
        </p>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-200">Quantity</label>
          <input
            v-model.number="quantity"
            type="number"
            min="1"
            placeholder="Enter quantity"
            class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex gap-2 justify-end pt-4">
          <button
            @click="$emit('close')"
            class="px-4 py-2 bg-slate-700 text-slate-100 rounded-md hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            {{ initialQuantity ? 'Update' : 'Add' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

