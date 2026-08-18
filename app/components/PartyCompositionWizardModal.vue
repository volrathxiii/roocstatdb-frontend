<script setup lang="ts">
interface ObjectiveOption {
  label: string;
  value: number;
}

interface SuggestedPlayer {
  id: number;
  ign: string;
  playerId: string;
  job: string | null;
  classRole: string | null;
  score: number;
  note: string;
  capabilitySource: "selected" | "potential";
  topCapabilities: string[];
}

interface CapabilityBreakdownRow {
  capabilityKey: string;
  weight: number;
  fillPercent: number;
  selectedFillPercent: number;
  potentialFillPercent: number;
  filledBy: string | null;
  filledBySource: "selected" | "potential" | null;
  effectiveness: number;
}

const props = defineProps<{
  open: boolean;
  partyName: string | null;
  currentPartyMemberIds: number[];
  objectiveId: number | undefined;
  objectiveOptions: ObjectiveOption[];
  objectiveDescription: string | null;
  explanation: string;
  capabilityBreakdown: CapabilityBreakdownRow[];
  suggestedPlayers: SuggestedPlayer[];
  loading: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:objectiveId": [value: number | undefined];
}>();

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

const objectiveIdModel = computed({
  get: () => props.objectiveId,
  set: (value: number | undefined) => emit("update:objectiveId", value),
});

const currentPartyMemberIdSet = computed(() => new Set(props.currentPartyMemberIds));

function isAlreadyInParty(memberId: number) {
  return currentPartyMemberIdSet.value.has(memberId);
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #content>
      <UCard class="border border-amber-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">
            Party Composition Wizard - {{ partyName ?? "-" }}
          </span>
        </template>

        <div class="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <section class="space-y-3">
            <UFormField label="Objective" required>
              <USelect
                v-model:model-value="objectiveIdModel"
                :items="objectiveOptions"
                value-key="value"
                label-key="label"
                class="w-full"
                searchable
                clearable
                nullable
                placeholder="Select objective"
              />
            </UFormField>

            <p v-if="objectiveDescription" class="text-xs text-slate-400">
              {{ objectiveDescription }}
            </p>

            <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Explanation</p>
              <p class="text-sm text-slate-200">{{ explanation }}</p>
            </div>

            <div class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Capability Fill</p>

              <div v-if="loading" class="text-xs text-slate-500">
                Calculating weighted capability fill...
              </div>

              <div v-else-if="capabilityBreakdown.length === 0" class="text-xs text-slate-500">
                Select an objective to view capability fill bars.
              </div>

              <div v-else class="space-y-2.5">
                <div v-for="row in capabilityBreakdown" :key="row.capabilityKey" class="space-y-1">
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="text-slate-200">{{ row.capabilityKey }}</span>
                    <span class="text-slate-500">w{{ row.weight }}</span>
                  </div>
                  <div class="h-2 overflow-hidden rounded bg-slate-800">
                    <div class="flex h-full">
                      <div
                        v-if="row.selectedFillPercent > 0"
                        class="h-full bg-cyan-500/80"
                        :style="{ width: `${row.selectedFillPercent}%` }"
                      />
                      <div
                        v-if="row.potentialFillPercent > 0"
                        class="h-full bg-amber-500/80"
                        :style="{ width: `${row.potentialFillPercent}%` }"
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{{ row.fillPercent.toFixed(0) }}% fill</span>
                    <span>{{ row.filledBy ? `${row.filledBy} (eff ${row.effectiveness})` : 'unfilled' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Suggested Players ({{ suggestedPlayers.length }}/5)
            </p>

            <div v-if="loading" class="flex justify-center py-6">
              <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-slate-400" />
            </div>

            <div v-else-if="suggestedPlayers.length === 0" class="text-sm text-slate-500">
              Select an objective to generate suggested players.
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="member in suggestedPlayers"
                :key="member.id"
                :class="[
                  'rounded border px-2.5 py-2',
                  isAlreadyInParty(member.id)
                    ? 'border-emerald-500/70 bg-emerald-950/25 ring-1 ring-emerald-500/30'
                    : 'border-slate-700 bg-slate-950/70',
                ]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-1.5">
                      <p class="text-sm font-medium text-slate-100">{{ member.ign }}</p>
                      <UBadge
                        v-if="isAlreadyInParty(member.id)"
                        color="success"
                        variant="soft"
                        size="xs"
                      >
                        In Party
                      </UBadge>
                      <UBadge
                        v-if="member.capabilitySource === 'potential'"
                        color="warning"
                        variant="soft"
                        size="xs"
                      >
                        Potential
                      </UBadge>
                    </div>
                    <p class="text-xs text-slate-400">
                      {{ member.job && member.classRole ? `${member.job} / ${member.classRole}` : "No snapshot" }}
                    </p>
                    <p class="text-[11px] text-slate-500">{{ member.note }}</p>
                  </div>
                  <UBadge color="primary" variant="soft">{{ member.score.toFixed(1) }}</UBadge>
                </div>
                <p v-if="member.topCapabilities.length > 0" class="mt-1 text-[11px] text-cyan-300">
                  {{ member.topCapabilities.join(', ') }}
                </p>
                <p class="mt-1 text-[11px] text-slate-500">
                  {{ member.playerId }}
                </p>
              </div>
            </div>
          </section>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="openModel = false">Close</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
