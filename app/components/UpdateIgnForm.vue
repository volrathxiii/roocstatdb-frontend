<script setup lang="ts">
const { auth, updateIgn } = useAuth();

const ignForm = reactive({ ign: "" });
const ignSaving = ref(false);
const ignError = ref<string | null>(null);
const ignSuccess = ref<string | null>(null);

watch(
  () => auth.value.player?.ign,
  (value) => {
    ignForm.ign = value ?? "";
  },
  { immediate: true },
);

const canSubmitIgn = computed(() => {
  const currentIgn = auth.value.player?.ign?.trim() ?? "";
  const nextIgn = ignForm.ign.trim();
  return !ignSaving.value && nextIgn.length > 0 && nextIgn !== currentIgn;
});

const saveIgn = async () => {
  ignError.value = null;
  ignSuccess.value = null;

  const playerId = auth.value.player?.id;
  const nextIgn = ignForm.ign.trim();

  if (!playerId) {
    ignError.value = "Unable to update IGN. Please log in again.";
    return;
  }

  if (!nextIgn) {
    ignError.value = "IGN is required.";
    return;
  }

  ignSaving.value = true;
  try {
    await updateIgn(playerId, nextIgn);
    ignSuccess.value = "IGN updated successfully.";
  } catch (err: unknown) {
    if (err && typeof err === "object" && "data" in err) {
      const fetchErr = err as { data?: { message?: string | string[] } };
      const message = fetchErr.data?.message;
      ignError.value = Array.isArray(message)
        ? message.join(" ")
        : (message ?? "Failed to update IGN.");
    } else {
      ignError.value = "Failed to update IGN.";
    }
  } finally {
    ignSaving.value = false;
  }
};
</script>

<template>
  <form class="space-y-3 w-1/2" @submit.prevent="saveIgn" novalidate>
    <UFormField label="Change IGN">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          v-model="ignForm.ign"
          placeholder="Enter new IGN"
          :disabled="ignSaving"
          icon="i-lucide-pencil"
          class="w-full"
        />

        <UButton
          type="submit"
          :loading="ignSaving"
          :disabled="!canSubmitIgn"
          icon="i-lucide-save"
          class="sm:shrink-0"
        >
          {{ ignSaving ? "Saving..." : "Update IGN" }}
        </UButton>
      </div>
    </UFormField>

    <UAlert
      v-if="ignError"
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
      :title="ignError"
    />

    <UAlert
      v-if="ignSuccess"
      color="success"
      variant="soft"
      icon="i-lucide-circle-check"
      :title="ignSuccess"
    />
  </form>
</template>
