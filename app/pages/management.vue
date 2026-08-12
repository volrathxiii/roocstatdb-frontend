<script setup lang="ts">
const { auth } = useAuth();
const { setSubtitle } = usePageSubtitle();
const config = useRuntimeConfig();
const backendUrl = config.public.backendUrl;

definePageMeta({
  layout: "authenticated",
});

// Admin-only guard
onMounted(() => {
  if (!auth.value.player) return navigateTo("/login");
  if (auth.value.role !== "Admin") return navigateTo("/dashboard");
  setSubtitle("Management");
});

// ── Types ────────────────────────────────────────────────────────────────────
interface RefItem { id: number; name: string }
type ClassRank = "PDMG" | "MDMG" | "DEF";

interface PartyPresetRecord {
  id?: number;
  position: number;
  jobId: number | undefined;
  classRoleId: number | undefined;
  classRank: ClassRank | undefined;
}

interface PartyPreset {
  id: number;
  name: string;
  records: PartyPresetRecord[];
  createdAt: string;
  updatedAt: string;
}

// ── State ────────────────────────────────────────────────────────────────────
const jobClasses  = ref<RefItem[]>([]);
const classRoles  = ref<RefItem[]>([]);
const partyPresets = ref<PartyPreset[]>([]);

const modal = reactive({
  open:    false,
  type:    "" as "job-classes" | "class-roles",
  label:   "",
  editing: null as RefItem | null,
  name:    "",
});

const presetModal = reactive({
  open: false,
  editingId: null as number | null,
  name: "",
  records: [] as PartyPresetRecord[],
});

const deletePresetModal = reactive({
  open: false,
  presetId: null as number | null,
  name: "",
});

const classRankOptions = [
  { label: "None", value: undefined },
  { label: "PDMG", value: "PDMG" as ClassRank },
  { label: "MDMG", value: "MDMG" as ClassRank },
  { label: "DEF", value: "DEF" as ClassRank },
];

const actorPlayerId = computed(() => auth.value.player?.playerId ?? "");
const jobClassOptions = computed(() =>
  jobClasses.value.map((item) => ({ label: item.name, value: item.id })),
);
const classRoleOptions = computed(() => [
  { label: "None", value: undefined },
  ...classRoles.value.map((item) => ({ label: item.name, value: item.id })),
]);
const canAddPresetRecord = computed(() => presetModal.records.length < 5);

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchAll() {
  const [j, c, p] = await Promise.all([
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/job-classes`),
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/class-roles`),
    $fetch<{ presets: PartyPreset[] }>(`${backendUrl}/api/party-presets`, {
      query: { playerId: actorPlayerId.value },
    }),
  ]);
  jobClasses.value  = j;
  classRoles.value  = c;
  partyPresets.value = p.presets;
}

onMounted(fetchAll);

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openAdd(type: "job-classes" | "class-roles", label: string) {
  modal.type    = type;
  modal.label   = label;
  modal.editing = null;
  modal.name    = "";
  modal.open    = true;
}

function openEdit(type: "job-classes" | "class-roles", label: string, item: RefItem) {
  modal.type    = type;
  modal.label   = label;
  modal.editing = item;
  modal.name    = item.name;
  modal.open    = true;
}

function closeModal() {
  modal.open = false;
}

async function saveModal() {
  const name = modal.name.trim();
  if (!name) return;

  if (modal.editing) {
    await $fetch(`${backendUrl}/api/ref-data/${modal.type}/${modal.editing.id}`, {
      method: "PATCH",
      body: { name },
    });
  } else {
    await $fetch(`${backendUrl}/api/ref-data/${modal.type}`, {
      method: "POST",
      body: { name },
    });
  }

  modal.open = false;
  await fetchAll();
}

function newPresetRecord(position: number): PartyPresetRecord {
  return {
    position,
    jobId: undefined,
    classRoleId: undefined,
    classRank: undefined,
  };
}

function openAddPreset() {
  presetModal.open = true;
  presetModal.editingId = null;
  presetModal.name = "";
  presetModal.records = [newPresetRecord(0)];
}

function openEditPreset(preset: PartyPreset) {
  presetModal.open = true;
  presetModal.editingId = preset.id;
  presetModal.name = preset.name;
  presetModal.records = preset.records
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((record, index) => ({
      id: record.id,
      position: index,
      jobId: record.jobId,
      classRoleId: record.classRoleId ?? undefined,
      classRank: record.classRank ?? undefined,
    }));
}

function closePresetModal() {
  presetModal.open = false;
}

function addPresetRecord() {
  if (!canAddPresetRecord.value) return;
  presetModal.records.push(newPresetRecord(presetModal.records.length));
}

function removePresetRecord(index: number) {
  presetModal.records.splice(index, 1);
  for (const [i, record] of presetModal.records.entries()) {
    record.position = i;
  }
}

function presetRowHasError(record: PartyPresetRecord) {
  return record.jobId === undefined;
}

function canSavePreset() {
  if (!presetModal.name.trim()) return false;
  return presetModal.records.every((record) => record.jobId !== undefined);
}

async function savePresetModal() {
  if (!canSavePreset()) return;

  const payload = {
    playerId: actorPlayerId.value,
    name: presetModal.name.trim(),
    records: presetModal.records.map((record, index) => ({
      position: index,
      jobId: record.jobId,
      classRoleId: record.classRoleId ?? null,
      classRank: record.classRank ?? null,
    })),
  };

  if (presetModal.editingId) {
    await $fetch(`${backendUrl}/api/party-presets/${presetModal.editingId}`, {
      method: "PATCH",
      body: payload,
    });
  } else {
    await $fetch(`${backendUrl}/api/party-presets`, {
      method: "POST",
      body: payload,
    });
  }

  presetModal.open = false;
  await fetchAll();
}

function openDeletePresetModal(preset: PartyPreset) {
  deletePresetModal.open = true;
  deletePresetModal.presetId = preset.id;
  deletePresetModal.name = preset.name;
}

function closeDeletePresetModal() {
  deletePresetModal.open = false;
  deletePresetModal.presetId = null;
  deletePresetModal.name = "";
}

async function confirmDeletePreset() {
  if (!deletePresetModal.presetId) return;
  await $fetch(`${backendUrl}/api/party-presets/${deletePresetModal.presetId}`, {
    method: "DELETE",
    query: { playerId: actorPlayerId.value },
  });
  closeDeletePresetModal();
  await fetchAll();
}
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <!-- Job Classes card -->
    <UCard class="border border-cyan-900/40 bg-slate-950/70">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-white">Job Classes</span>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            size="sm"
            @click="openAdd('job-classes', 'Job Class')"
          />
        </div>
      </template>

      <ul class="divide-y divide-slate-800">
        <li
          v-for="item in jobClasses"
          :key="item.id"
          class="flex items-center justify-between py-2"
        >
          <span class="text-slate-200">{{ item.name }}</span>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="openEdit('job-classes', 'Job Class', item)"
          />
        </li>
        <li v-if="!jobClasses.length" class="py-3 text-center text-sm text-slate-500">
          No job classes yet.
        </li>
      </ul>
    </UCard>

    <!-- Class Roles card -->
    <UCard class="border border-cyan-900/40 bg-slate-950/70">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-white">Class Roles</span>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            size="sm"
            @click="openAdd('class-roles', 'Class Role')"
          />
        </div>
      </template>

      <ul class="divide-y divide-slate-800">
        <li
          v-for="item in classRoles"
          :key="item.id"
          class="flex items-center justify-between py-2"
        >
          <span class="text-slate-200">{{ item.name }}</span>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="openEdit('class-roles', 'Class Role', item)"
          />
        </li>
        <li v-if="!classRoles.length" class="py-3 text-center text-sm text-slate-500">
          No class roles yet.
        </li>
      </ul>
    </UCard>

    <!-- Party Presets card -->
    <UCard class="border border-cyan-900/40 bg-slate-950/70">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold text-white">Party Presets</span>
          <UButton
            icon="i-lucide-plus"
            color="primary"
            variant="soft"
            size="sm"
            @click="openAddPreset"
          />
        </div>
      </template>

      <ul class="divide-y divide-slate-800">
        <li
          v-for="preset in partyPresets"
          :key="preset.id"
          class="py-2"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-slate-200">{{ preset.name }}</p>
              <p class="text-xs text-slate-500">{{ preset.records.length }}/5 records</p>
            </div>
            <div class="flex items-center gap-1">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="openEditPreset(preset)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                @click="openDeletePresetModal(preset)"
              />
            </div>
          </div>
        </li>
        <li v-if="!partyPresets.length" class="py-3 text-center text-sm text-slate-500">
          No party presets yet.
        </li>
      </ul>
    </UCard>
  </div>

  <!-- Add / Edit modal -->
  <UModal v-model:open="modal.open">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">
            {{ modal.editing ? `Edit ${modal.label}` : `Add ${modal.label}` }}
          </span>
        </template>

        <div class="space-y-4">
          <UFormField label="Name" required>
            <UInput
              v-model="modal.name"
              placeholder="Enter name"
              autofocus
              class="w-full"
              @keyup.enter="saveModal"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeModal">Cancel</UButton>
            <UButton color="primary" @click="saveModal">
              {{ modal.editing ? "Save" : "Add" }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Party Preset add / edit modal -->
  <UModal v-model:open="presetModal.open">
    <template #content>
      <UCard class="border border-cyan-900/40 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">
            {{ presetModal.editingId ? "Edit Party Preset" : "Add Party Preset" }}
          </span>
        </template>

        <div class="space-y-4">
          <UFormField label="Preset Name" required>
            <UInput
              v-model="presetModal.name"
              placeholder="Enter preset name"
              autofocus
              class="w-full"
            />
          </UFormField>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-slate-300">Records ({{ presetModal.records.length }}/5)</p>
              <UButton
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="xs"
                :disabled="!canAddPresetRecord"
                @click="addPresetRecord"
              >
                Add Record
              </UButton>
            </div>

            <div v-for="(record, index) in presetModal.records" :key="record.id ?? index" class="rounded-md border border-slate-800 p-3">
              <div class="mb-3 flex items-center justify-between">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Record {{ index + 1 }}</p>
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  @click="removePresetRecord(index)"
                />
              </div>

              <div class="grid gap-3 md:grid-cols-3">
                <UFormField label="Job Class" required>
                  <USelect
                    v-model="record.jobId"
                    :items="jobClassOptions"
                    value-key="value"
                    label-key="label"
                    placeholder="Select job..."
                    class="w-full"
                    :color="presetRowHasError(record) ? 'error' : undefined"
                  />
                </UFormField>

                <UFormField label="Class Role">
                  <USelect
                    v-model="record.classRoleId"
                    :items="classRoleOptions"
                    value-key="value"
                    label-key="label"
                    placeholder="Any role"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Priority Stat">
                  <div class="flex gap-1 pt-1">
                    <UTooltip text="PDMG">
                      <UButton
                        icon="i-lucide-sword"
                        size="sm"
                        :color="record.classRank === 'PDMG' ? 'primary' : 'neutral'"
                        :variant="record.classRank === 'PDMG' ? 'solid' : 'outline'"
                        @click="record.classRank = record.classRank === 'PDMG' ? undefined : 'PDMG'"
                      />
                    </UTooltip>
                    <UTooltip text="MDMG">
                      <UButton
                        icon="i-lucide-wand"
                        size="sm"
                        :color="record.classRank === 'MDMG' ? 'primary' : 'neutral'"
                        :variant="record.classRank === 'MDMG' ? 'solid' : 'outline'"
                        @click="record.classRank = record.classRank === 'MDMG' ? undefined : 'MDMG'"
                      />
                    </UTooltip>
                    <UTooltip text="DEF">
                      <UButton
                        icon="i-lucide-shield"
                        size="sm"
                        :color="record.classRank === 'DEF' ? 'primary' : 'neutral'"
                        :variant="record.classRank === 'DEF' ? 'solid' : 'outline'"
                        @click="record.classRank = record.classRank === 'DEF' ? undefined : 'DEF'"
                      />
                    </UTooltip>
                  </div>
                </UFormField>
              </div>
            </div>

            <p v-if="!presetModal.records.length" class="text-sm text-slate-500">
              No records yet. Add up to 5 records.
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closePresetModal">Cancel</UButton>
            <UButton color="primary" :disabled="!canSavePreset()" @click="savePresetModal">
              {{ presetModal.editingId ? "Save" : "Add" }}
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <!-- Delete preset confirmation modal -->
  <UModal v-model:open="deletePresetModal.open">
    <template #content>
      <UCard class="border border-red-900/50 bg-slate-950">
        <template #header>
          <span class="font-semibold text-white">Delete Party Preset</span>
        </template>

        <p class="text-sm text-slate-300">
          Delete preset "{{ deletePresetModal.name }}"? This action cannot be undone.
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeDeletePresetModal">Cancel</UButton>
            <UButton color="error" @click="confirmDeletePreset">Delete</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>