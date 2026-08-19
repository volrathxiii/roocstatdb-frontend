<script setup lang="ts">
interface ObjectiveOption {
  label: string;
  value: number;
}

type WizardTab = "objective-focus" | "player-focus";

interface PlayerFocusIntentCard {
  id: number;
  name: string;
  description: string | null;
  averageScore: number;
  matchedCount: number;
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
  matchedSkills: {
    id: number;
    name: string;
    description: string | null;
    matchedCapabilities: string[];
    capabilityEffectivenessByKey: Record<string, number>;
  }[];
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

interface CapabilityContribution {
  playerName: string;
  jobName: string;
  skillId: number;
  skillName: string;
  description: string | null;
  effectiveness: number;
}

const props = defineProps<{
  open: boolean;
  partyName: string | null;
  currentPartyMemberIds: number[];
  objectiveId: number | undefined;
  activeTab: WizardTab;
  objectiveOptions: ObjectiveOption[];
  playerFocusCards: PlayerFocusIntentCard[];
  playerFocusLoading: boolean;
  objectiveDescription: string | null;
  explanation: string;
  capabilityBreakdown: CapabilityBreakdownRow[];
  suggestedPlayers: SuggestedPlayer[];
  loading: boolean;
  applyingSuggestedMembers: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:objectiveId": [value: number | undefined];
  "update:activeTab": [value: WizardTab];
  "apply-suggested": [memberIds: number[]];
}>();

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

const objectiveIdModel = computed({
  get: () => props.objectiveId,
  set: (value: number | undefined) => emit("update:objectiveId", value),
});

const activeTabModel = computed({
  get: () => props.activeTab,
  set: (value: WizardTab) => emit("update:activeTab", value),
});

const missingSkillIconIds = ref(new Set<number>());

const currentPartyMemberIdSet = computed(() => new Set(props.currentPartyMemberIds));

function isAlreadyInParty(memberId: number) {
  return currentPartyMemberIdSet.value.has(memberId);
}

function markSkillIconMissing(skillId: number) {
  missingSkillIconIds.value.add(skillId);
}

function skillInitials(skillName: string) {
  const words = skillName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function getCapabilityContributions(capabilityKey: string): CapabilityContribution[] {
  const contributions: CapabilityContribution[] = [];

  for (const member of props.suggestedPlayers) {
    for (const skill of member.matchedSkills) {
      if (!skill.matchedCapabilities.includes(capabilityKey)) continue;
      contributions.push({
        playerName: member.ign,
        jobName: member.job ?? "Unknown",
        skillId: skill.id,
        skillName: skill.name,
        description: skill.description,
        effectiveness: skill.capabilityEffectivenessByKey[capabilityKey] ?? 0,
      });
    }
  }

  return contributions.sort((a, b) => {
    if (b.effectiveness !== a.effectiveness) {
      return b.effectiveness - a.effectiveness;
    }
    if (a.playerName !== b.playerName) {
      return a.playerName.localeCompare(b.playerName);
    }
    return a.skillName.localeCompare(b.skillName);
  });
}

function getVisibleCapabilityContributions(capabilityKey: string) {
  return getCapabilityContributions(capabilityKey).slice(0, 5);
}

function hasMoreCapabilityContributions(capabilityKey: string) {
  return getCapabilityContributions(capabilityKey).length > 5;
}

function emitApplySuggested() {
  emit("apply-suggested", props.suggestedPlayers.map((member) => member.id));
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

        <div class="mb-3 inline-flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition"
            :class="activeTabModel === 'objective-focus' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'"
            @click="activeTabModel = 'objective-focus'"
          >
            Objective Focus
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition"
            :class="activeTabModel === 'player-focus' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800'"
            @click="activeTabModel = 'player-focus'"
          >
            Player Focus
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <section class="space-y-3">
            <UFormField v-if="activeTabModel === 'objective-focus'" label="Objective" required>
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

            <div v-else class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Top Intent Matches</p>
              <div v-if="playerFocusLoading" class="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                Calculating best intents for current party members...
              </div>
              <div v-else-if="playerFocusCards.length === 0" class="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                No intent score data available for this party.
              </div>
              <div v-else class="grid gap-2">
                <button
                  v-for="card in playerFocusCards"
                  :key="card.id"
                  type="button"
                  class="rounded-lg border p-2.5 text-left transition"
                  :class="objectiveIdModel === card.id ? 'border-cyan-500/60 bg-cyan-950/20' : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'"
                  @click="objectiveIdModel = card.id"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-medium text-slate-100">{{ card.name }}</p>
                    <UBadge color="primary" variant="soft">Avg {{ card.averageScore.toFixed(1) }}</UBadge>
                  </div>
                  <p v-if="card.description" class="mt-1 text-xs text-slate-400">{{ card.description }}</p>
                  <p class="mt-1 text-[11px] text-slate-500">Matched current members: {{ card.matchedCount }}</p>
                </button>
              </div>
            </div>

            <p v-if="objectiveDescription" class="text-xs text-slate-400">
              {{ objectiveDescription }}
            </p>

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
                  <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <UPopover
                      v-for="(contribution, index) in getVisibleCapabilityContributions(row.capabilityKey)"
                      :key="`${row.capabilityKey}-${contribution.playerName}-${contribution.skillId}-${index}`"
                      mode="hover"
                    >
                      <button
                        type="button"
                        class="rounded border border-slate-700 bg-slate-900/80 p-0.5 transition hover:border-cyan-500/70"
                      >
                        <img
                          v-if="!missingSkillIconIds.has(contribution.skillId)"
                          :src="`/skills/${contribution.skillId}.webp`"
                          :alt="contribution.skillName"
                          class="h-5 w-5 rounded object-cover"
                          @error="markSkillIconMissing(contribution.skillId)"
                        >
                        <div
                          v-else
                          class="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[8px] font-semibold text-slate-200"
                          :aria-label="contribution.skillName"
                        >
                          {{ skillInitials(contribution.skillName) }}
                        </div>
                      </button>

                      <template #content>
                        <div class="max-w-xs p-2">
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-xs font-semibold text-slate-100">{{ contribution.playerName }}</p>
                            <span class="text-[10px] font-semibold text-cyan-300">Eff {{ contribution.effectiveness }}</span>
                          </div>
                          <p class="mt-1 text-[11px] text-slate-300">{{ contribution.jobName }} - {{ contribution.skillName }}</p>
                          <p class="mt-1 text-[11px] text-slate-300">{{ contribution.description || "No description" }}</p>
                        </div>
                      </template>
                    </UPopover>
                    <span
                      v-if="hasMoreCapabilityContributions(row.capabilityKey)"
                      class="flex h-5 w-5 items-center justify-center rounded border border-slate-700 bg-slate-900/80 text-[11px] font-semibold text-slate-300"
                      aria-label="More skills"
                      title="More skills"
                    >
                      +
                    </span>
                    <span
                      v-if="getCapabilityContributions(row.capabilityKey).length === 0"
                      class="text-[11px] text-slate-500"
                    >
                      No contributing skill
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {{ activeTabModel === 'player-focus' ? 'Accompanying Party Members' : 'Suggested Players' }} ({{ suggestedPlayers.length }}/5)
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
                  </div>
                  <UBadge color="primary" variant="soft">{{ member.score.toFixed(1) }}</UBadge>
                </div>
                <div v-if="member.matchedSkills.length > 0" class="mt-1.5 flex flex-wrap gap-1">
                  <UPopover
                    v-for="skill in member.matchedSkills"
                    :key="`${member.id}-${skill.id}`"
                    mode="hover"
                  >
                    <button
                      type="button"
                      class="rounded border border-slate-700 bg-slate-900/80 p-0.5 transition hover:border-cyan-500/70"
                    >
                      <img
                        v-if="!missingSkillIconIds.has(skill.id)"
                        :src="`/skills/${skill.id}.webp`"
                        :alt="skill.name"
                        class="h-6 w-6 rounded object-cover"
                        @error="markSkillIconMissing(skill.id)"
                      >
                      <div
                        v-else
                        class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-[9px] font-semibold text-slate-200"
                        :aria-label="skill.name"
                      >
                        {{ skillInitials(skill.name) }}
                      </div>
                    </button>

                    <template #content>
                      <div class="max-w-xs p-2">
                        <p class="text-xs font-semibold text-slate-100">{{ skill.name }}</p>
                        <p class="mt-1 text-[11px] text-slate-300">{{ skill.description || "No description" }}</p>
                      </div>
                    </template>
                  </UPopover>
                </div>
              </div>

              <UButton
                class="mt-2 w-full justify-center"
                color="primary"
                :loading="applyingSuggestedMembers"
                :disabled="loading || suggestedPlayers.length === 0 || applyingSuggestedMembers"
                @click="emitApplySuggested"
              >
                Apply Suggested Members
              </UButton>
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
