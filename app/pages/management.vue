<script setup lang="ts">
definePageMeta({
  layout: "authenticated",
  middleware: "auth-admin",
});

const api = useApi();
const { setSubtitle } = usePageSubtitle();

onMounted(() => {
  setSubtitle("Management");
});

interface RefItem { id: number; name: string }
type ClassRank = "PDMG" | "MDMG" | "DEF";
type SectionType = "job-classes" | "class-roles" | "settings" | "party-presets" | "score-weights";

interface ScoreWeightsPayload {
  physical: Record<string, number>;
  magic: Record<string, number>;
  defensive: Record<string, number>;
}

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

interface AppSetting {
  key: string;
  label: string;
  description: string;
  defaultValue: string;
  value: string;
  isOverridden: boolean;
}

interface SectionCard {
  type: SectionType;
  title: string;
  icon: string;
  summary: string;
  count: string;
}

const BOOLEAN_SETTING_KEYS = new Set([
  "PARTY_SUGGESTIONS_ENABLED",
]);

const booleanSettingOptions = [
  { label: "Enabled", value: "true" },
  { label: "Disabled", value: "false" },
];

const PHYSICAL_WEIGHT_DEFAULTS: Record<string, number> = {
  ignorePdef: 25,
  dmgVsDemiHuman: 23,
  dmgVsMedium: 20,
  pDmgPct: 16,
  patk: 14,
  pvpDmg: 2,
};

const MAGIC_WEIGHT_DEFAULTS: Record<string, number> = {
  ignoreMdef: 25,
  dmgVsDemiHuman: 23,
  dmgVsMedium: 20,
  mDmgPct: 16,
  matk: 14,
  pvpDmg: 2,
};

const DEFENSIVE_WEIGHT_DEFAULTS: Record<string, number> = {
  dmgReductionVsDemiHuman: 18,
  dmgReductionVsMedium: 16,
  pDmgReductionPct: 12,
  mDmgReductionPct: 12,
  rawPdef: 11,
  rawMdef: 11,
  hp: 8,
  healingTaken: 6,
  healingDone: 4,
  pvpDmgReduction: 2,
};

const physicalFields = [
  { key: "ignorePdef", label: "Ignore PDEF" },
  { key: "dmgVsDemiHuman", label: "DMG vs Demi-Human" },
  { key: "dmgVsMedium", label: "DMG vs Medium" },
  { key: "pDmgPct", label: "PDMG %" },
  { key: "patk", label: "PATK" },
  { key: "pvpDmg", label: "PVP DMG" },
] as const;

const magicFields = [
  { key: "ignoreMdef", label: "Ignore MDEF" },
  { key: "dmgVsDemiHuman", label: "DMG vs Demi-Human" },
  { key: "dmgVsMedium", label: "DMG vs Medium" },
  { key: "mDmgPct", label: "MDMG %" },
  { key: "matk", label: "MATK" },
  { key: "pvpDmg", label: "PVP DMG" },
] as const;

const defensiveFields = [
  { key: "dmgReductionVsDemiHuman", label: "Reduction vs Demi-Human" },
  { key: "dmgReductionVsMedium", label: "Reduction vs Medium" },
  { key: "pDmgReductionPct", label: "PDMG Reduction %" },
  { key: "mDmgReductionPct", label: "MDMG Reduction %" },
  { key: "rawPdef", label: "Raw PDEF" },
  { key: "rawMdef", label: "Raw MDEF" },
  { key: "hp", label: "HP" },
  { key: "healingTaken", label: "Healing Taken" },
  { key: "healingDone", label: "Healing Done" },
  { key: "pvpDmgReduction", label: "PVP Reduction" },
] as const;

const jobClasses = ref<RefItem[]>([]);
const classRoles = ref<RefItem[]>([]);
const partyPresets = ref<PartyPreset[]>([]);
const appSettings = ref<AppSetting[]>([]);
const settingDrafts = ref<Record<string, string>>({});
const settingSaving = ref<Record<string, boolean>>({});
const settingSaved = ref<Record<string, boolean>>({});

const scoreWeightDrafts = reactive({
  physical: { ...PHYSICAL_WEIGHT_DEFAULTS },
  magic: { ...MAGIC_WEIGHT_DEFAULTS },
  defensive: { ...DEFENSIVE_WEIGHT_DEFAULTS },
});
const scoreWeightSaving = ref(false);
const scoreWeightSaved = ref(false);

const sectionModal = reactive({
  open: false,
  type: "job-classes" as SectionType,
});

const modal = reactive({
  open: false,
  type: "" as "job-classes" | "class-roles",
  label: "",
  editing: null as RefItem | null,
  name: "",
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

const jobClassOptions = computed(() =>
  jobClasses.value.map((item) => ({ label: item.name, value: item.id })),
);

const classRoleOptions = computed(() => [
  { label: "None", value: undefined },
  ...classRoles.value.map((item) => ({ label: item.name, value: item.id })),
]);

const canAddPresetRecord = computed(() => presetModal.records.length < 5);

const visibleAppSettings = computed(() => appSettings.value);

function isBooleanSetting(setting: AppSetting) {
  return BOOLEAN_SETTING_KEYS.has(setting.key);
}

const cards = computed<SectionCard[]>(() => {
  const overriddenSettings = visibleAppSettings.value.filter((setting) => setting.isOverridden).length;
  return [
    {
      type: "job-classes",
      title: "Job Classes",
      icon: "i-lucide-swords",
      summary: "Manage selectable job class options.",
      count: `${jobClasses.value.length}`,
    },
    {
      type: "class-roles",
      title: "Class Roles",
      icon: "i-lucide-shield-check",
      summary: "Manage role options per class entry.",
      count: `${classRoles.value.length}`,
    },
    {
      type: "settings",
      title: "Settings",
      icon: "i-lucide-settings-2",
      summary: "Configure system-level behavior and webhooks.",
      count: `${overriddenSettings}/${visibleAppSettings.value.length} overridden`,
    },
    {
      type: "score-weights",
      title: "Score Weights",
      icon: "i-lucide-scale",
      summary: "Edit weighted formulas for PDMG, MDMG, and DEF.",
      count: "3 score groups",
    },
    {
      type: "party-presets",
      title: "Party Presets",
      icon: "i-lucide-layout-template",
      summary: "Create templates for party setup suggestions.",
      count: `${partyPresets.value.length}`,
    },
  ];
});

function syncWeightDraftsFromPayload(payload: ScoreWeightsPayload | null | undefined) {
  const resolved = payload ?? {
    physical: PHYSICAL_WEIGHT_DEFAULTS,
    magic: MAGIC_WEIGHT_DEFAULTS,
    defensive: DEFENSIVE_WEIGHT_DEFAULTS,
  };
  Object.assign(scoreWeightDrafts.physical, PHYSICAL_WEIGHT_DEFAULTS, resolved.physical ?? {});
  Object.assign(scoreWeightDrafts.magic, MAGIC_WEIGHT_DEFAULTS, resolved.magic ?? {});
  Object.assign(scoreWeightDrafts.defensive, DEFENSIVE_WEIGHT_DEFAULTS, resolved.defensive ?? {});
}

async function fetchAll() {
  const [j, c, p, s, w] = await Promise.all([
    api.get<RefItem[]>("/api/ref-data/job-classes"),
    api.get<RefItem[]>("/api/ref-data/class-roles"),
    api.get<{ presets: PartyPreset[] }>("/api/party-presets"),
    api.get<AppSetting[]>("/api/settings"),
    api.get<ScoreWeightsPayload>("/api/score-weights"),
  ]);

  jobClasses.value = j;
  classRoles.value = c;
  partyPresets.value = p.presets;
  appSettings.value = s;
  settingDrafts.value = Object.fromEntries(s.map((setting) => [setting.key, setting.value]));
  syncWeightDraftsFromPayload(w);
}

async function saveSetting(key: string) {
  settingSaving.value[key] = true;
  try {
    await api.put(`/api/settings/${encodeURIComponent(key)}`, { value: settingDrafts.value[key] ?? "" });
    const setting = appSettings.value.find((s) => s.key === key);
    if (setting) {
      setting.value = settingDrafts.value[key] ?? "";
      setting.isOverridden = true;
    }
    settingSaved.value[key] = true;
    setTimeout(() => {
      settingSaved.value[key] = false;
    }, 2500);
  } finally {
    settingSaving.value[key] = false;
  }
}

async function resetSetting(key: string) {
  await api.del(`/api/settings/${encodeURIComponent(key)}`);
  const setting = appSettings.value.find((s) => s.key === key);
  if (setting) {
    setting.value = setting.defaultValue;
    setting.isOverridden = false;
    settingDrafts.value[key] = setting.defaultValue;
  }
}

async function saveScoreWeights() {
  scoreWeightSaving.value = true;
  try {
    const payload: ScoreWeightsPayload = {
      physical: { ...scoreWeightDrafts.physical },
      magic: { ...scoreWeightDrafts.magic },
      defensive: { ...scoreWeightDrafts.defensive },
    };

    await api.put("/api/score-weights", payload);

    scoreWeightSaved.value = true;
    setTimeout(() => {
      scoreWeightSaved.value = false;
    }, 2500);
  } finally {
    scoreWeightSaving.value = false;
  }
}

async function resetScoreWeights() {
  syncWeightDraftsFromPayload({
    physical: PHYSICAL_WEIGHT_DEFAULTS,
    magic: MAGIC_WEIGHT_DEFAULTS,
    defensive: DEFENSIVE_WEIGHT_DEFAULTS,
  });
  await saveScoreWeights();
}

onMounted(fetchAll);

function sectionTitle(type: SectionType) {
  const map: Record<SectionType, string> = {
    "job-classes": "Job Classes",
    "class-roles": "Class Roles",
    settings: "Settings",
    "party-presets": "Party Presets",
    "score-weights": "Score Weights",
  };
  return map[type];
}

function openSection(type: SectionType) {
  sectionModal.type = type;
  sectionModal.open = true;
}

function closeSection() {
  sectionModal.open = false;
}

function openAdd(type: "job-classes" | "class-roles", label: string) {
  modal.type = type;
  modal.label = label;
  modal.editing = null;
  modal.name = "";
  modal.open = true;
}

function openEdit(type: "job-classes" | "class-roles", label: string, item: RefItem) {
  modal.type = type;
  modal.label = label;
  modal.editing = item;
  modal.name = item.name;
  modal.open = true;
}

function closeModal() {
  modal.open = false;
}

async function saveModal() {
  const name = modal.name.trim();
  if (!name) return;

  if (modal.editing) {
    await api.patch(`/api/ref-data/${modal.type}/${modal.editing.id}`, { name });
  } else {
    await api.post(`/api/ref-data/${modal.type}`, { name });
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
    name: presetModal.name.trim(),
    records: presetModal.records.map((record, index) => ({
      position: index,
      jobId: record.jobId,
      classRoleId: record.classRoleId ?? null,
      classRank: record.classRank ?? null,
    })),
  };

  if (presetModal.editingId) {
    await api.patch(`/api/party-presets/${presetModal.editingId}`, payload);
  } else {
    await api.post(`/api/party-presets`, payload);
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
  await api.del(`/api/party-presets/${deletePresetModal.presetId}`);
  closeDeletePresetModal();
  await fetchAll();
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <UCard
      v-for="card in cards"
      :key="card.type"
      class="cursor-pointer border border-cyan-900/40 bg-slate-950/70 transition hover:border-cyan-700/70"
      @click="openSection(card.type)"
    >
      <div class="flex items-start justify-between gap-2">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <UIcon :name="card.icon" class="h-4 w-4 text-cyan-300" />
            <p class="font-semibold text-white">{{ card.title }}</p>
          </div>
          <p class="text-sm text-slate-400">{{ card.summary }}</p>
        </div>
        <span class="rounded bg-slate-900 px-2 py-1 text-xs text-cyan-200">{{ card.count }}</span>
      </div>
      <div class="mt-3 flex justify-end">
        <UButton size="xs" color="primary" variant="soft" @click.stop="openSection(card.type)">Open</UButton>
      </div>
    </UCard>
  </div>

  <UModal v-model:open="sectionModal.open">
    <template #content>
      <UCard
        class="w-full border border-cyan-900/40 bg-slate-950 max-h-[60vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <span class="font-semibold text-white">{{ sectionTitle(sectionModal.type) }}</span>
            <div class="flex items-center gap-2">
              <UButton
                v-if="sectionModal.type === 'job-classes'"
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="sm"
                @click="openAdd('job-classes', 'Job Class')"
              />
              <UButton
                v-if="sectionModal.type === 'class-roles'"
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="sm"
                @click="openAdd('class-roles', 'Class Role')"
              />
              <UButton
                v-if="sectionModal.type === 'party-presets'"
                icon="i-lucide-plus"
                color="primary"
                variant="soft"
                size="sm"
                @click="openAddPreset"
              />
            </div>
          </div>
        </template>

        <div v-if="sectionModal.type === 'job-classes'">
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
        </div>

        <div v-else-if="sectionModal.type === 'class-roles'">
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
        </div>

        <div v-else-if="sectionModal.type === 'settings'">
          <ul class="divide-y divide-slate-800">
            <li
              v-for="setting in visibleAppSettings"
              :key="setting.key"
              class="py-3"
            >
              <div class="mb-1.5 flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm font-medium text-slate-200">{{ setting.label }}</p>
                  <p class="text-xs text-slate-500">{{ setting.description }}</p>
                </div>
                <UButton
                  v-if="setting.isOverridden"
                  icon="i-lucide-rotate-ccw"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  title="Reset to default"
                  @click="resetSetting(setting.key)"
                />
              </div>
              <div class="flex gap-2">
                <USelect
                  v-if="isBooleanSetting(setting)"
                  v-model:model-value="settingDrafts[setting.key]"
                  :items="booleanSettingOptions"
                  value-key="value"
                  label-key="label"
                  class="flex-1"
                  size="sm"
                />
                <UInput
                  v-else
                  v-model="settingDrafts[setting.key]"
                  :placeholder="setting.defaultValue || 'Not set'"
                  class="flex-1 font-mono text-xs"
                  size="sm"
                  @keyup.enter="saveSetting(setting.key)"
                />
                <UButton
                  size="sm"
                  :color="settingSaved[setting.key] ? 'success' : 'primary'"
                  :icon="settingSaved[setting.key] ? 'i-lucide-check' : 'i-lucide-save'"
                  :loading="settingSaving[setting.key]"
                  :disabled="settingDrafts[setting.key] === setting.value"
                  @click="saveSetting(setting.key)"
                >
                  {{ settingSaved[setting.key] ? 'Saved' : 'Save' }}
                </UButton>
              </div>
            </li>
            <li v-if="!visibleAppSettings.length" class="py-3 text-center text-sm text-slate-500">
              No settings available.
            </li>
          </ul>
        </div>

        <div v-else-if="sectionModal.type === 'score-weights'" class="space-y-4">
          <div class="grid grid-cols-1 gap-4">
            <UCard class="border border-slate-800 bg-slate-900/40">
              <template #header>
                <p class="font-semibold text-slate-100">Physical DPS</p>
              </template>
              <div class="space-y-2">
                <div v-for="field in physicalFields" :key="field.key" class="flex items-center gap-2">
                  <span class="w-1/2 text-xs text-slate-400">{{ field.label }}</span>
                  <UInput
                    v-model.number="scoreWeightDrafts.physical[field.key]"
                    type="number"
                    min="0"
                    step="1"
                    class="w-1/2"
                    size="xs"
                  />
                </div>
              </div>
            </UCard>

            <UCard class="border border-slate-800 bg-slate-900/40">
              <template #header>
                <p class="font-semibold text-slate-100">Magic DPS</p>
              </template>
              <div class="space-y-2">
                <div v-for="field in magicFields" :key="field.key" class="flex items-center gap-2">
                  <span class="w-1/2 text-xs text-slate-400">{{ field.label }}</span>
                  <UInput
                    v-model.number="scoreWeightDrafts.magic[field.key]"
                    type="number"
                    min="0"
                    step="1"
                    class="w-1/2"
                    size="xs"
                  />
                </div>
              </div>
            </UCard>

            <UCard class="border border-slate-800 bg-slate-900/40">
              <template #header>
                <p class="font-semibold text-slate-100">Defense</p>
              </template>
              <div class="space-y-2">
                <div v-for="field in defensiveFields" :key="field.key" class="flex items-center gap-2">
                  <span class="w-1/2 text-xs text-slate-400">{{ field.label }}</span>
                  <UInput
                    v-model.number="scoreWeightDrafts.defensive[field.key]"
                    type="number"
                    min="0"
                    step="1"
                    class="w-1/2"
                    size="xs"
                  />
                </div>
              </div>
            </UCard>
          </div>

        </div>

        <div v-else-if="sectionModal.type === 'party-presets'">
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
        </div>

        <template #footer>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2" v-if="sectionModal.type === 'score-weights'">
              <UButton color="neutral" variant="soft" @click="resetScoreWeights">Reset Defaults</UButton>
              <UButton
                color="primary"
                :loading="scoreWeightSaving"
                :icon="scoreWeightSaved ? 'i-lucide-check' : 'i-lucide-save'"
                @click="saveScoreWeights"
              >
                {{ scoreWeightSaved ? 'Saved' : 'Save Weights' }}
              </UButton>
            </div>
            <UButton color="neutral" variant="soft" @click="closeSection">Close</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

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
