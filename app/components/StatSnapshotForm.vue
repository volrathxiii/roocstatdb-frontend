<script setup lang="ts">
const api = useApi();
const config = useRuntimeConfig();

// ── Ref data ────────────────────────────────────────────────────────────────
interface RefItem { id: number; name: string }

const jobClasses = ref<RefItem[]>([]);
const classRoles = ref<RefItem[]>([]);

// ── Form state ──────────────────────────────────────────────────────────────
const form = reactive({
  jobId: null as number | null,
  classRoleId: null as number | null,
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
  'patk', 'matk', 'ignorePdef', 'ignoreMdef',
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
    const [jobRes, roleRes, snapRes] = await Promise.all([
      api.get<RefItem[]>("/api/ref-data/job-classes"),
      api.get<RefItem[]>("/api/ref-data/class-roles"),
      api.get<{ snapshot: Record<string, unknown> | null }>(
        `/api/stat-snapshots/latest`
      ),
    ]);
    jobClasses.value = jobRes;
    classRoles.value = roleRes;

    if (snapRes.snapshot) {
      applySnapshot(snapRes.snapshot);
    }
  } catch (e) {
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
      jobId: form.jobId,
      classRoleId: form.classRoleId,
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
        <span v-if="savedWeekLabel" class="text-xs text-slate-400">
          Last saved: {{ savedWeekLabel }}
        </span>
      </div>
    </template>

    <div v-if="loading" class="flex justify-center py-10">
      <UIcon name="i-lucide-loader" class="animate-spin text-3xl text-slate-400" />
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSubmit">

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

      <!-- Core Attack -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Core Attack</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="PATK" class="w-full">
            <UInput v-model.number="form.patk" type="number" :min="0" class="w-full" :color="fieldError('patk') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="MATK" class="w-full">
            <UInput v-model.number="form.matk" type="number" :min="0" class="w-full" :color="fieldError('matk') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Ignore DEF -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Ignore DEF</p>
        <div class="grid grid-cols-2 gap-4">
            <UFormField label="Ignore PDEF" class="w-full">
            <UInput v-model.number="form.ignorePdef" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('ignorePdef') ? 'error' : undefined" />
          </UFormField>
            <UFormField label="Ignore MDEF" class="w-full">
            <UInput v-model.number="form.ignoreMdef" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('ignoreMdef') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Equipment DEF -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Equipment DEF</p>
        <div class="grid grid-cols-2 gap-4">
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
          <UFormField label="EQ PDEF %" class="w-full">
            <UInput v-model.number="form.eqPdefPct" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('eqPdefPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="EQ MDEF %" class="w-full">
            <UInput v-model.number="form.eqMdefPct" type="number" :min="0" step="0.01" class="w-full" :color="fieldError('eqMdefPct') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Physical Damage -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Physical Damage (%)</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="P DMG %" class="w-full">
            <UInput v-model.number="form.pDmgPct" type="number" step="0.01" class="w-full" :color="fieldError('pDmgPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="P DMG Reduction %" class="w-full">
            <UInput v-model.number="form.pDmgReductionPct" type="number" step="0.01" class="w-full" :color="fieldError('pDmgReductionPct') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Magic Damage -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Magic Damage (%)</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="M DMG %" class="w-full">
            <UInput v-model.number="form.mDmgPct" type="number" step="0.01" class="w-full" :color="fieldError('mDmgPct') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="M DMG Reduction %" class="w-full">
            <UInput v-model.number="form.mDmgReductionPct" type="number" step="0.01" class="w-full" :color="fieldError('mDmgReductionPct') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Demi-Human -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Demi-Human (%)</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="DMG vs Demi-Human %" class="w-full">
            <UInput v-model.number="form.dmgVsDemiHuman" type="number" step="0.01" class="w-full" :color="fieldError('dmgVsDemiHuman') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG Reduction vs Demi-Human %" class="w-full">
            <UInput v-model.number="form.dmgReductionVsDemiHuman" type="number" step="0.01" class="w-full" :color="fieldError('dmgReductionVsDemiHuman') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Medium Size -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Medium Size (%)</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="DMG vs Medium %" class="w-full">
            <UInput v-model.number="form.dmgVsMedium" type="number" step="0.01" class="w-full" :color="fieldError('dmgVsMedium') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="DMG Reduction vs Medium %" class="w-full">
            <UInput v-model.number="form.dmgReductionVsMedium" type="number" step="0.01" class="w-full" :color="fieldError('dmgReductionVsMedium') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- PVP -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">PVP</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="PVP DMG" class="w-full">
            <UInput v-model.number="form.pvpDmg" type="number" step="0.01" class="w-full" :color="fieldError('pvpDmg') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="PVP DMG Reduction" class="w-full">
            <UInput v-model.number="form.pvpDmgReduction" type="number" step="0.01" class="w-full" :color="fieldError('pvpDmgReduction') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Healing -->
      <div>
        <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Healing (%)</p>
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Healing Done" class="w-full">
            <UInput v-model.number="form.healingDone" type="number" step="0.01" class="w-full" :color="fieldError('healingDone') ? 'error' : undefined" />
          </UFormField>
          <UFormField label="Healing Taken" class="w-full">
            <UInput v-model.number="form.healingTaken" type="number" step="0.01" class="w-full" :color="fieldError('healingTaken') ? 'error' : undefined" />
          </UFormField>
        </div>
      </div>

      <!-- Alerts -->
      <UAlert v-if="errorMsg" color="error" variant="soft" icon="i-lucide-circle-x" :description="errorMsg" />
      <UAlert v-if="successMsg" color="success" variant="soft" icon="i-lucide-circle-check" :description="successMsg" />

      <!-- Submit -->
      <div class="flex justify-end">
        <UButton type="submit" :loading="saving" icon="i-lucide-save" color="primary">
          Save Stats
        </UButton>
      </div>

    </form>
  </UCard>
</template>
