<script setup lang="ts">
const props = withDefaults(defineProps<{ showBuilds?: boolean }>(), { showBuilds: true });

const api = useApi();

// ── Ref data ────────────────────────────────────────────────────────────────
interface RefItem { id: number; name: string }
interface StatBuild { id: number; name: string; isDefault: boolean; createdAt: string }
interface BuildSkillCapability { id: number; name: string; effectiveness: number }
interface BuildSkillOption {
  id: number;
  name: string;
  description: string | null;
  capabilities: BuildSkillCapability[];
}
interface BuildSkillsResponse {
  buildId: number;
  jobId: number;
  classRoleId: number;
  selectedSkillIds: number[];
  availableSkills: BuildSkillOption[];
}

const jobClasses = ref<RefItem[]>([]);
const classRoles = ref<RefItem[]>([]);

// ── Build state ──────────────────────────────────────────────────────────────
const builds = ref<StatBuild[]>([]);
const selectedBuildId = ref<number | null>(null);
const newBuildName = ref('');
const buildModalOpen = ref(false);
const buildPopoverOpen = ref(false);
const skillsModalOpen = ref(false);
const skillsLoading = ref(false);
const skillsSaving = ref(false);
const skillsError = ref<string | null>(null);
const automaticPartySuggestionsEnabled = ref(false);
const availableSkills = ref<BuildSkillOption[]>([]);
const selectedSkillIds = ref<number[]>([]);
const editingBuildId = ref<number | null>(null);
const editingName = ref('');

function filterToAvailableSkillIds(skillIds: number[]) {
  const allowed = new Set(availableSkills.value.map((skill) => skill.id));
  return skillIds.filter((id) => allowed.has(id));
}

async function fetchBuilds() {
  const res = await api.get<StatBuild[]>('/api/stat-snapshots/builds');
  builds.value = [...res].sort((a, b) => a.name.localeCompare(b.name));
  if (!selectedBuildId.value) {
    selectedBuildId.value = res.find(b => b.isDefault)?.id ?? res[0]?.id ?? null;
  }
}

async function loadSnapshotForBuild(buildId: number) {
  const res = await api.get<{ snapshot: Record<string, unknown> | null }>(
    `/api/stat-snapshots/latest?buildId=${buildId}`
  );
  savedWeekLabel.value = null;
  resetForm();
  if (res.snapshot) applySnapshot(res.snapshot);
}

async function onBuildChange(buildId: number) {
  if (buildId === selectedBuildId.value) return;
  selectedBuildId.value = buildId;
  buildPopoverOpen.value = false;
  await loadSnapshotForBuild(buildId);
}

async function addBuild() {
  if (!newBuildName.value.trim()) return;
  await api.post('/api/stat-snapshots/builds', { name: newBuildName.value.trim() });
  newBuildName.value = '';
  buildModalOpen.value = false;
  await fetchBuilds();
}

function startEdit(build: StatBuild) {
  editingBuildId.value = build.id;
  editingName.value = build.name;
}

function cancelEdit() {
  editingBuildId.value = null;
  editingName.value = '';
}

async function saveEdit(buildId: number) {
  if (!editingName.value.trim()) return;
  await api.patch(`/api/stat-snapshots/builds/${buildId}/rename`, { name: editingName.value.trim() });
  editingBuildId.value = null;
  await fetchBuilds();
}

async function setDefault(buildId: number) {
  await api.patch(`/api/stat-snapshots/builds/${buildId}/set-default`, {});
  await fetchBuilds();
}

async function deleteBuild(buildId: number) {
  await api.del(`/api/stat-snapshots/builds/${buildId}`);
  const remaining = builds.value.filter(b => b.id !== buildId);
  const defaultBuild = remaining.find(b => b.isDefault) ?? remaining[0];
  selectedBuildId.value = defaultBuild?.id ?? null;
  await fetchBuilds();
  if (selectedBuildId.value) await loadSnapshotForBuild(selectedBuildId.value);
}

async function openSkillsModal() {
  if (!selectedBuildId.value || !form.jobId || !form.classRoleId) return;
  skillsError.value = null;
  skillsLoading.value = true;
  skillsModalOpen.value = true;
  try {
    const res = await api.get<BuildSkillsResponse>(
      `/api/stat-snapshots/builds/${selectedBuildId.value}/skills?jobId=${form.jobId}&classRoleId=${form.classRoleId}`,
    );
    availableSkills.value = res.availableSkills;
    // Keep only selectable skills so hidden legacy IDs are not re-submitted.
    selectedSkillIds.value = filterToAvailableSkillIds(res.selectedSkillIds);
  } catch {
    skillsError.value = "Failed to load skills for this build.";
    availableSkills.value = [];
    selectedSkillIds.value = [];
  } finally {
    skillsLoading.value = false;
  }
}

function toggleSkillSelection(skillId: number) {
  if (selectedSkillIds.value.includes(skillId)) {
    selectedSkillIds.value = selectedSkillIds.value.filter((id) => id !== skillId);
  } else {
    selectedSkillIds.value = [...selectedSkillIds.value, skillId];
  }
}

async function saveSkillsSelection() {
  if (!selectedBuildId.value || !form.jobId || !form.classRoleId) return;
  skillsSaving.value = true;
  skillsError.value = null;
  try {
    const skillIds = filterToAvailableSkillIds(selectedSkillIds.value);
    await api.put(`/api/stat-snapshots/builds/${selectedBuildId.value}/skills`, {
      jobId: form.jobId,
      classRoleId: form.classRoleId,
      skillIds,
    });
    selectedSkillIds.value = skillIds;
    skillsModalOpen.value = false;
    successMsg.value = "Build skills updated.";
  } catch {
    skillsError.value = "Failed to save selected skills.";
  } finally {
    skillsSaving.value = false;
  }
}

function resetForm() {
  form.jobId = null;
  form.classRoleId = null;
  for (const k of numericKeys) form[k] = 0;
}

// ── Form state ──────────────────────────────────────────────────────────────
const form = reactive({
  jobId: null as number | null,
  classRoleId: null as number | null,
  hp: 0,
  patk: 0,
  matk: 0,
  ignorePdef: 0,
  ignoreMdef: 0,
  eqPdef: 0,
  eqMdef: 0,
  eqPdefPct: 0,
  eqMdefPct: 0,
  pDmgPct: 0,
  pDmgReductionPct: 0,
  mDmgPct: 0,
  mDmgReductionPct: 0,
  dmgVsDemiHuman: 0,
  dmgReductionVsDemiHuman: 0,
  dmgVsMedium: 0,
  dmgReductionVsMedium: 0,
  pvpDmg: 0,
  pvpDmgReduction: 0,
  healingDone: 0,
  healingTaken: 0,
});

const loading = ref(true);
const saving = ref(false);
const submitted = ref(false);
const savedWeekLabel = ref<string | null>(null);
const errorMsg = ref<string | null>(null);
const successMsg = ref<string | null>(null);

const numericKeys = [
  'hp', 'patk', 'matk', 'ignorePdef', 'ignoreMdef',
  'eqPdef', 'eqMdef', 'eqPdefPct', 'eqMdefPct',
  'pDmgPct', 'pDmgReductionPct', 'mDmgPct', 'mDmgReductionPct',
  'dmgVsDemiHuman', 'dmgReductionVsDemiHuman',
  'dmgVsMedium', 'dmgReductionVsMedium',
  'pvpDmg', 'pvpDmgReduction',
  'healingDone', 'healingTaken',
] as const;

function fieldError(key: keyof typeof form): boolean {
  if (!submitted.value) return false;
  const val = form[key];
  return val === null || Number(val) < 0;
}

function applySnapshot(snapshot: Record<string, unknown>) {
  form.jobId = (snapshot.job as RefItem).id;
  form.classRoleId = (snapshot.classRole as RefItem).id;
  form.hp = snapshot.hp as number;
  form.patk = snapshot.patk as number;
  form.matk = snapshot.matk as number;
  form.ignorePdef = Number(snapshot.ignorePdef);
  form.ignoreMdef = Number(snapshot.ignoreMdef);
  form.eqPdef = snapshot.eqPdef as number;
  form.eqMdef = snapshot.eqMdef as number;
  form.eqPdefPct = Number(snapshot.eqPdefPct);
  form.eqMdefPct = Number(snapshot.eqMdefPct);
  form.pDmgPct = Number(snapshot.pDmgPct);
  form.pDmgReductionPct = Number(snapshot.pDmgReductionPct);
  form.mDmgPct = Number(snapshot.mDmgPct);
  form.mDmgReductionPct = Number(snapshot.mDmgReductionPct);
  form.dmgVsDemiHuman = Number(snapshot.dmgVsDemiHuman);
  form.dmgReductionVsDemiHuman = Number(snapshot.dmgReductionVsDemiHuman);
  form.dmgVsMedium = Number(snapshot.dmgVsMedium);
  form.dmgReductionVsMedium = Number(snapshot.dmgReductionVsMedium);
  form.pvpDmg = Number(snapshot.pvpDmg);
  form.pvpDmgReduction = Number(snapshot.pvpDmgReduction);
  form.healingDone = Number(snapshot.healingDone);
  form.healingTaken = Number(snapshot.healingTaken);
  savedWeekLabel.value = `Week ${snapshot.weekNumber}, ${snapshot.year}`;
}

onMounted(async () => {
  try {
    const [jobRes, roleRes, buildsRes, suggestionToggleRes] = await Promise.all([
      api.get<RefItem[]>("/api/ref-data/job-classes"),
      api.get<RefItem[]>("/api/ref-data/class-roles"),
      props.showBuilds ? api.get<StatBuild[]>("/api/stat-snapshots/builds") : Promise.resolve([] as StatBuild[]),
      api.get<{ enabled: boolean }>("/api/settings/party-suggestions-enabled").catch(() => ({ enabled: false })),
    ]);
    jobClasses.value = jobRes;
    classRoles.value = roleRes;
    automaticPartySuggestionsEnabled.value = suggestionToggleRes.enabled;

    if (props.showBuilds) {
      builds.value = [...buildsRes].sort((a, b) => a.name.localeCompare(b.name));
      const defaultBuild = buildsRes.find(b => b.isDefault) ?? buildsRes[0];
      selectedBuildId.value = defaultBuild?.id ?? null;
      if (defaultBuild) {
        const snapRes = await api.get<{ snapshot: Record<string, unknown> | null }>(
          `/api/stat-snapshots/latest?buildId=${defaultBuild.id}`
        );
        if (snapRes.snapshot) applySnapshot(snapRes.snapshot);
      }
    } else {
      const snapRes = await api.get<{ snapshot: Record<string, unknown> | null }>(
        `/api/stat-snapshots/latest`
      );
      if (snapRes.snapshot) applySnapshot(snapRes.snapshot);
    }
  } catch {
    errorMsg.value = "Failed to load data. Please refresh.";
  } finally {
    loading.value = false;
  }
});

async function handleSubmit() {
  errorMsg.value = null;
  successMsg.value = null;
  submitted.value = true;

  const hasInvalid = !form.jobId || !form.classRoleId || numericKeys.some(k => form[k] < 0);
  if (hasInvalid) {
    errorMsg.value = "All fields must have a value greater than or equal to 0.";
    return;
  }

  saving.value = true;
  try {
    await api.post(`/api/stat-snapshots`, {
      ...(selectedBuildId.value ? { buildId: selectedBuildId.value } : {}),
      jobId: form.jobId,
      classRoleId: form.classRoleId,
      hp: form.hp,
      patk: form.patk,
      matk: form.matk,
      ignorePdef: form.ignorePdef,
      ignoreMdef: form.ignoreMdef,
      eqPdef: form.eqPdef,
      eqMdef: form.eqMdef,
      eqPdefPct: form.eqPdefPct,
      eqMdefPct: form.eqMdefPct,
      pDmgPct: form.pDmgPct,
      pDmgReductionPct: form.pDmgReductionPct,
      mDmgPct: form.mDmgPct,
      mDmgReductionPct: form.mDmgReductionPct,
      dmgVsDemiHuman: form.dmgVsDemiHuman,
      dmgReductionVsDemiHuman: form.dmgReductionVsDemiHuman,
      dmgVsMedium: form.dmgVsMedium,
      dmgReductionVsMedium: form.dmgReductionVsMedium,
      pvpDmg: form.pvpDmg,
      pvpDmgReduction: form.pvpDmgReduction,
      healingDone: form.healingDone,
      healingTaken: form.healingTaken,
    });
      successMsg.value = "Stats saved for this week.";
  } catch {
    errorMsg.value = "Failed to save stats. Please try again.";
  } finally {
    saving.value = false;
  }
}

const jobOptions = computed(() =>
  jobClasses.value.map((j) => ({ label: j.name, value: j.id }))
);
const classRoleOptions = computed(() =>
  classRoles.value.map((r) => ({ label: r.name, value: r.id }))
);
</script>

<template>
  <UCard class="border border-slate-700/50 bg-slate-950/70">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-white">Character Stats</h3>

        <div class="flex items-center gap-2">
          <!-- Build split button -->
          <div v-if="props.showBuilds && builds.length > 0" class="flex items-center gap-0">
          <span class="inline-flex items-center px-3 h-8 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-600 rounded-l-md border-r-0 select-none">
            Build
          </span>
          <UPopover v-model:open="buildPopoverOpen" :content="{ align: 'end', side: 'bottom' }">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 h-8 text-sm font-medium text-white bg-slate-700 border border-slate-600 rounded-r-md hover:bg-slate-600 transition-colors"
            >
              <UIcon
                v-if="builds.find(b => b.id === selectedBuildId)?.isDefault"
                name="i-lucide-star"
                class="size-3.5 text-white fill-white"
              />
              {{ builds.find(b => b.id === selectedBuildId)?.name ?? '—' }}
              <UIcon name="i-lucide-chevron-down" class="size-3.5 text-slate-400" />
            </button>
            <template #content>
              <div class="py-1 min-w-48">
                <!-- All builds -->
                <div
                  v-for="build in builds"
                  :key="build.id"
                  class="flex items-center gap-2 px-3 py-1.5 group"
                  :class="build.id !== selectedBuildId ? 'cursor-pointer hover:bg-slate-700' : 'opacity-60 cursor-default'"
                  @click="build.id !== selectedBuildId && onBuildChange(build.id)"
                >
                  <!-- Name / edit input -->
                  <div class="flex-1 flex items-center gap-1.5 min-w-0">
                    <UIcon
                      v-if="build.isDefault"
                      name="i-lucide-star"
                      class="size-3.5 shrink-0 text-yellow-400 fill-yellow-400"
                    />
                    <template v-if="editingBuildId === build.id">
                      <UInput
                        v-model="editingName"
                        size="xs"
                        class="flex-1"
                        autofocus
                        @click.stop
                        @keydown.enter.stop="saveEdit(build.id)"
                        @keydown.esc.stop="cancelEdit"
                      />
                    </template>
                    <span v-else class="text-sm text-white truncate">{{ build.name }}</span>
                  </div>

                  <!-- Action icons -->
                  <div class="flex items-center gap-1 shrink-0" @click.stop>
                    <template v-if="editingBuildId === build.id">
                      <UButton size="xs" variant="ghost" color="primary" icon="i-lucide-check" @click="saveEdit(build.id)" />
                      <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="cancelEdit" />
                    </template>
                    <template v-else>
                      <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" class="opacity-0 group-hover:opacity-100" @click="startEdit(build)" />
                      <UButton
                        v-if="!build.isDefault"
                        size="xs" variant="ghost" color="neutral" icon="i-lucide-star"
                        class="opacity-0 group-hover:opacity-100"
                        @click="setDefault(build.id)"
                      />
                      <UButton
                        v-if="!build.isDefault"
                        size="xs" variant="ghost" color="error" icon="i-lucide-trash-2"
                        class="opacity-0 group-hover:opacity-100"
                        @click="deleteBuild(build.id)"
                      />
                    </template>
                  </div>
                </div>

                <!-- Divider + New build -->
                <div class="border-t border-slate-700 mt-1 pt-1">
                  <button
                    type="button"
                    class="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    @click="buildModalOpen = true; buildPopoverOpen = false"
                  >
                    <UIcon name="i-lucide-plus" class="size-4" />
                    New build…
                  </button>
                </div>
              </div>
            </template>
          </UPopover>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader" class="animate-spin text-3xl text-slate-400" />
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSubmit">

      <!-- New build modal -->
      <UModal v-model:open="buildModalOpen" title="New Build">
        <template #body>
          <div class="flex gap-2">
            <UInput v-model="newBuildName" placeholder="Build name (e.g. PVP)" class="flex-1" @keydown.enter="addBuild" />
            <UButton @click="addBuild">Create</UButton>
          </div>
        </template>
      </UModal>

      <UModal v-model:open="skillsModalOpen" title="Skills">
        <template #body>
          <div class="space-y-3">
            <p class="text-xs text-slate-400">
              Select capability-linked skills for this build and job class.
            </p>

            <UAlert
              v-if="skillsError"
              color="error"
              variant="soft"
              icon="i-lucide-alert-circle"
              :title="skillsError"
            />

            <div v-if="skillsLoading" class="flex justify-center py-6">
              <UIcon name="i-lucide-loader" class="animate-spin text-2xl text-slate-400" />
            </div>

            <div v-else-if="availableSkills.length === 0" class="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
              No capability-linked skills available for this job class.
            </div>

            <div v-else class="max-h-80 space-y-2 overflow-y-auto pr-1">
              <button
                v-for="skill in availableSkills"
                :key="skill.id"
                type="button"
                class="w-full rounded border p-3 text-left transition-colors"
                :class="selectedSkillIds.includes(skill.id)
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'"
                @click="toggleSkillSelection(skill.id)"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-medium text-slate-100">{{ skill.name }}</p>
                    <p v-if="skill.description" class="mt-0.5 text-xs text-slate-400">{{ skill.description }}</p>
                    <p class="mt-1 text-xs text-slate-400">
                      {{ skill.capabilities.map((c) => `${c.name} (${c.effectiveness})`).join(', ') }}
                    </p>
                  </div>
                  <UIcon
                    v-if="selectedSkillIds.includes(skill.id)"
                    name="i-lucide-check"
                    class="mt-0.5 size-4 text-cyan-400"
                  />
                </div>
              </button>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="soft" :disabled="skillsSaving" @click="skillsModalOpen = false">Cancel</UButton>
              <UButton :loading="skillsSaving" :disabled="skillsLoading" @click="saveSkillsSelection">Save Skills</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <UAlert
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
      >
        <template #title>
          Please provide stats that are <strong>not buffed</strong>.
        </template>
        <template #description>
          This means <strong>no self-buffs</strong>, <strong>no food buffs</strong>, and <strong>no consumables</strong>. Only your <strong>base stats</strong> and <strong>equipment</strong> values.
        </template>
      </UAlert>

      <!-- Last saved label -->
      <p v-if="savedWeekLabel" class="text-xs text-slate-400">Last saved: {{ savedWeekLabel }}</p>

      <!-- Job & Role -->
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Job Class" required class="w-full">
          <USelect
            v-model="form.jobId"
            :items="jobOptions"
            value-key="value"
            label-key="label"
            placeholder="Select job..."
            class="w-full"
            :color="fieldError('jobId') ? 'error' : undefined"
          />
        </UFormField>
        <UFormField label="Class Role" required class="w-full">
          <USelect
            v-model="form.classRoleId"
            :items="classRoleOptions"
            value-key="value"
            label-key="label"
            placeholder="Select role..."
            class="w-full"
            :color="fieldError('classRoleId') ? 'error' : undefined"
          />
        </UFormField>
      </div>

      <!-- General Stats -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">General Stats</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="HP" class="w-full">
            <UInput v-model.number="form.hp" type="number" :min="0" class="w-full" :color="fieldError('hp') ? 'error' : undefined" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-4 mt-4">
          <UFormField label="PATK" class="w-full">
            <UInput v-model.number="form.patk" type="number" :min="0" class="w-full" :color="fieldError('patk') ? 'error' : undefined" />
          </UFormField>
          <UFormField class="w-full">
            <template #label>
              <span class="flex items-center gap-1">
                EQ PDEF (flat)
                <UPopover mode="hover" :popper="{ placement: 'right' }">
                  <UIcon name="i-lucide-info" class="h-3.5 w-3.5 text-slate-400 cursor-help" />
                  <template #content>
                    <div class="p-3 text-sm max-w-xs space-y-1">
                      <p>To find your <strong>Equipment PDEF</strong>:</p>
                      <ol class="list-decimal list-inside space-y-1 text-slate-300">
                        <li>Open the <strong>Character Details</strong> screen</li>
                        <li>Under <strong>General Stats</strong>, click on <strong>PDEF</strong></li>
                        <li>A breakdown modal will open — use the <strong>Equipment PDEF</strong> value</li>
                      </ol>
                    </div>
                  </template>
                </UPopover>
              </span>
            </template>
            <UInput v-model.number="form.eqPdef" type="number" :min="0" class="w-full" :color="fieldError('eqPdef') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="MATK" class="w-full">
            <UInput v-model.number="form.matk" type="number" :min="0" class="w-full" :color="fieldError('matk') ? 'error' : undefined" />
          </UFormField>
          <UFormField class="w-full">
            <template #label>
              <span class="flex items-center gap-1">
                EQ MDEF (flat)
                <UPopover mode="hover" :popper="{ placement: 'right' }">
                  <UIcon name="i-lucide-info" class="h-3.5 w-3.5 text-slate-400 cursor-help" />
                  <template #content>
                    <div class="p-3 text-sm max-w-xs space-y-1">
                      <p>To find your <strong>Equipment MDEF</strong>:</p>
                      <ol class="list-decimal list-inside space-y-1 text-slate-300">
                        <li>Open the <strong>Character Details</strong> screen</li>
                        <li>Under <strong>General Stats</strong>, click on <strong>MDEF</strong></li>
                        <li>A breakdown modal will open — use the <strong>Equipment MDEF</strong> value</li>
                      </ol>
                    </div>
                  </template>
                </UPopover>
              </span>
            </template>
            <UInput v-model.number="form.eqMdef" type="number" :min="0" class="w-full" :color="fieldError('eqMdef') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Quasi-Stats -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Quasi-Stats</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Healing Done %" class="w-full">
            <UInput v-model.number="form.healingDone" type="number" step="0.01" class="w-full" :color="fieldError('healingDone') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="Healing Taken %" class="w-full">
            <UInput v-model.number="form.healingTaken" type="number" step="0.01" class="w-full" :color="fieldError('healingTaken') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="P DMG %" class="w-full">
            <UInput v-model.number="form.pDmgPct" type="number" step="0.01" class="w-full" :color="fieldError('pDmgPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="P DMG Reduction %" class="w-full">
            <UInput v-model.number="form.pDmgReductionPct" type="number" step="0.01" class="w-full" :color="fieldError('pDmgReductionPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="M DMG %" class="w-full">
            <UInput v-model.number="form.mDmgPct" type="number" step="0.01" class="w-full" :color="fieldError('mDmgPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="M DMG Reduction %" class="w-full">
            <UInput v-model.number="form.mDmgReductionPct" type="number" step="0.01" class="w-full" :color="fieldError('mDmgReductionPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="Ignore PDEF" class="w-full">
            <UInput v-model.number="form.ignorePdef" type="number" :min="0" class="w-full" :color="fieldError('ignorePdef') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="Ignore MDEF" class="w-full">
            <UInput v-model.number="form.ignoreMdef" type="number" :min="0" class="w-full" :color="fieldError('ignoreMdef') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="PVP DMG Reduction" class="w-full">
            <UInput v-model.number="form.pvpDmgReduction" type="number" :min="0" class="w-full" :color="fieldError('pvpDmgReduction') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="PVP DMG" class="w-full">
            <UInput v-model.number="form.pvpDmg" type="number" :min="0" class="w-full" :color="fieldError('pvpDmg') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Special -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Special</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="EQ PDEF %" class="w-full">
            <UInput v-model.number="form.eqPdefPct" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('eqPdefPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="EQ MDEF %" class="w-full">
            <UInput v-model.number="form.eqMdefPct" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('eqMdefPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG vs Medium %" class="w-full">
            <UInput v-model.number="form.dmgVsMedium" type="number" step="0.01" class="w-full" :color="fieldError('dmgVsMedium') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG Reduction vs Medium %" class="w-full">
            <UInput v-model.number="form.dmgReductionVsMedium" type="number" step="0.01" class="w-full" :color="fieldError('dmgReductionVsMedium') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG vs Demi-Human %" class="w-full">
            <UInput v-model.number="form.dmgVsDemiHuman" type="number" step="0.01" class="w-full" :color="fieldError('dmgVsDemiHuman') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG Reduction vs Demi-Human %" class="w-full">
            <UInput v-model.number="form.dmgReductionVsDemiHuman" type="number" step="0.01" class="w-full" :color="fieldError('dmgReductionVsDemiHuman') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Alerts -->
      <UAlert v-if="errorMsg" color="error" variant="soft" icon="i-lucide-circle-x" :description="errorMsg" />
      <UAlert v-if="successMsg" color="success" variant="soft" icon="i-lucide-circle-check" :description="successMsg" />

      <!-- Submit -->
      <div class="flex justify-end gap-2">
        <UButton
          v-if="automaticPartySuggestionsEnabled && props.showBuilds && selectedBuildId && form.jobId && form.classRoleId"
          type="button"
          color="neutral"
          variant="soft"
          icon="i-lucide-swords"
          @click="openSkillsModal"
        >
          Skills
        </UButton>
        <UButton type="submit" :loading="saving" icon="i-lucide-save" color="primary">
          Save Stats
        </UButton>
      </div>

    </form>
  </UCard>
</template>
