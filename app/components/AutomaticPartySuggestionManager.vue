<script setup lang="ts">
const props = withDefaults(defineProps<{
  enabled: boolean;
  mode?: "full" | "launcher";
}>(), {
  mode: "full",
});

const api = useApi();

interface RefItem {
  id: number;
  name: string;
}

interface Capability {
  id: number;
  name: string;
  description: string | null;
}

interface SkillCapability {
  id: number;
  capabilityId: number;
  effectiveness: number;
  capability: RefItem;
}

interface JobClassSkill {
  id: number;
  jobId: number;
  job: RefItem;
}

interface AdminSkill {
  id: number;
  name: string;
  description: string | null;
  jobClassSkills: JobClassSkill[];
  skillCapabilities: SkillCapability[];
}

interface IntentWeight {
  id: number;
  capabilityId: number;
  weight: number;
  capability: RefItem;
}

interface PartyIntent {
  id: number;
  name: string;
  description: string | null;
  jobDiversityPenalty: number;
  potentialGapMultiplier: number;
  weights: IntentWeight[];
}

interface CapabilityWeightDraft {
  capabilityId: number | undefined;
  weight: number;
}

interface CapabilityEffectDraft {
  capabilityId: number | undefined;
  effectiveness: number;
}

const loading = ref(false);
const saving = ref(false);

const jobClasses = ref<RefItem[]>([]);
const capabilities = ref<Capability[]>([]);
const skills = ref<AdminSkill[]>([]);
const objectives = ref<PartyIntent[]>([]);

const SKILLS_PER_PAGE = 8;
const skillSearchQuery = ref("");
const skillPage = ref(1);
const selectedSkillJobId = ref<number | undefined>(undefined);

const capabilityModal = reactive({
  open: false,
  editingId: null as number | null,
  name: "",
  description: "",
});

const skillModal = reactive({
  open: false,
  editingId: null as number | null,
  name: "",
  description: "",
  jobIds: [] as number[],
  capabilityEffects: [] as CapabilityEffectDraft[],
});

const objectiveModal = reactive({
  open: false,
  editingId: null as number | null,
  name: "",
  description: "",
  jobDiversityPenalty: 8,
  potentialGapMultiplier: 1,
  capabilityWeights: [] as CapabilityWeightDraft[],
});

const capabilityManagerModalOpen = ref(false);
const skillManagerModalOpen = ref(false);
const objectiveManagerModalOpen = ref(false);

const isLauncherMode = computed(() => props.mode === "launcher");

const capabilityOptions = computed(() =>
  capabilities.value.map((item) => ({ label: item.name, value: item.id })),
);

const jobClassOptions = computed(() =>
  jobClasses.value.map((item) => ({ label: item.name, value: item.id })),
);

const skillJobFilterOptions = computed(() => [
  { label: "All jobs", value: undefined },
  ...jobClassOptions.value,
]);

function getSkillJobNames(item: AdminSkill) {
  if (!item.jobClassSkills.length) return "Unassigned job";
  return item.jobClassSkills.map((entry) => entry.job.name).join(", ");
}

const topObjectiveWeights = (intent: PartyIntent) =>
  intent.weights
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((entry) => `${entry.capability.name} ${entry.weight}`)
    .join(" | ");

const filteredSkills = computed(() => {
  const query = skillSearchQuery.value.trim().toLowerCase();
  return skills.value.filter((item) => {
    const matchesJobFilter = selectedSkillJobId.value === undefined
      || item.jobClassSkills.some((entry) => entry.jobId === selectedSkillJobId.value);
    if (!matchesJobFilter) return false;

    if (!query) return true;

    const name = item.name.toLowerCase();
    const jobNames = item.jobClassSkills
      .map((entry) => entry.job.name.toLowerCase())
      .join(" ");
    const capabilityNames = item.skillCapabilities
      .map((entry) => entry.capability.name.toLowerCase())
      .join(" ");

    return name.includes(query) || jobNames.includes(query) || capabilityNames.includes(query);
  });
});

const totalSkillPages = computed(() => Math.max(1, Math.ceil(filteredSkills.value.length / SKILLS_PER_PAGE)));

const paginatedSkills = computed(() => {
  const start = (skillPage.value - 1) * SKILLS_PER_PAGE;
  return filteredSkills.value.slice(start, start + SKILLS_PER_PAGE);
});

const skillPaginationItems = computed<(number | "ellipsis")[]>(() => {
  const pages = totalSkillPages.value;
  if (pages <= 10) {
    return Array.from({ length: pages }, (_, idx) => idx + 1);
  }

  // Google-like dynamic window: always show first/last page,
  // and keep a 5-page window that moves with the active page.
  const windowSize = 5;
  let start = Math.max(2, skillPage.value - Math.floor(windowSize / 2));
  let end = Math.min(pages - 1, start + windowSize - 1);

  if ((end - start + 1) < windowSize) {
    start = Math.max(2, end - windowSize + 1);
  }

  const items: (number | "ellipsis")[] = [1];

  if (start > 2) {
    items.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (end < pages - 1) {
    items.push("ellipsis");
  }

  items.push(pages);
  return items;
});

watch([skillSearchQuery, selectedSkillJobId], () => {
  skillPage.value = 1;
});

watch(totalSkillPages, (pages) => {
  if (skillPage.value > pages) {
    skillPage.value = pages;
  }
});

function goToSkillPage(page: number) {
  if (page < 1 || page > totalSkillPages.value) return;
  skillPage.value = page;
}

function isSkillPageActive(page: number | "ellipsis") {
  return typeof page === "number" && page === skillPage.value;
}

async function fetchAll() {
  loading.value = true;
  try {
    const [jobs, caps, intents, skillRows] = await Promise.all([
      api.get<RefItem[]>("/api/ref-data/job-classes"),
      api.get<Capability[]>("/api/ref-data/capabilities"),
      api.get<PartyIntent[]>("/api/ref-data/party-intents"),
      api.get<AdminSkill[]>("/api/ref-data/skills-admin"),
    ]);

    jobClasses.value = jobs;
    capabilities.value = caps;
    objectives.value = intents;
    skills.value = skillRows;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAll);

function openAddCapability() {
  capabilityModal.open = true;
  capabilityModal.editingId = null;
  capabilityModal.name = "";
  capabilityModal.description = "";
}

function openEditCapability(item: Capability) {
  capabilityModal.open = true;
  capabilityModal.editingId = item.id;
  capabilityModal.name = item.name;
  capabilityModal.description = item.description ?? "";
}

function closeCapabilityModal() {
  capabilityModal.open = false;
}

async function saveCapability() {
  const name = capabilityModal.name.trim();
  if (!name) return;

  saving.value = true;
  try {
    const payload = {
      name,
      description: capabilityModal.description.trim() || null,
    };

    if (capabilityModal.editingId) {
      await api.patch(`/api/ref-data/capabilities/${capabilityModal.editingId}`, payload);
    } else {
      await api.post("/api/ref-data/capabilities", payload);
    }

    closeCapabilityModal();
    await fetchAll();
  } finally {
    saving.value = false;
  }
}

async function deleteCapability(item: Capability) {
  if (!confirm(`Delete capability "${item.name}"?`)) return;
  await api.del(`/api/ref-data/capabilities/${item.id}`);
  await fetchAll();
}

function openAddSkill() {
  skillModal.open = true;
  skillModal.editingId = null;
  skillModal.name = "";
  skillModal.description = "";
  skillModal.jobIds = [];
  skillModal.capabilityEffects = [];
}

function openEditSkill(item: AdminSkill) {
  skillModal.open = true;
  skillModal.editingId = item.id;
  skillModal.name = item.name;
  skillModal.description = item.description ?? "";
  const existingJobIds = item.jobClassSkills.map((entry) => entry.jobId);
  skillModal.jobIds = selectedSkillJobId.value === undefined
    ? existingJobIds
    : Array.from(new Set([selectedSkillJobId.value, ...existingJobIds]));
  skillModal.capabilityEffects = item.skillCapabilities.map((entry) => ({
    capabilityId: entry.capabilityId,
    effectiveness: entry.effectiveness,
  }));
}

function closeSkillModal() {
  skillModal.open = false;
}

function addSkillCapabilityEffect() {
  skillModal.capabilityEffects.push({ capabilityId: undefined, effectiveness: 1 });
}

function removeSkillCapabilityEffect(index: number) {
  skillModal.capabilityEffects.splice(index, 1);
}

async function saveSkill() {
  const name = skillModal.name.trim();
  if (!name || !skillModal.jobIds.length) return;

  const capabilityEffects = Array.from(
    new Map(
      skillModal.capabilityEffects
        .filter((entry) => entry.capabilityId !== undefined)
        .map((entry) => [entry.capabilityId as number, {
          capabilityId: entry.capabilityId as number,
          effectiveness: Math.max(0, Math.round(entry.effectiveness || 0)),
        }]),
    ).values(),
  );

  saving.value = true;
  try {
    const payload = {
      name,
      description: skillModal.description.trim() || null,
      jobIds: skillModal.jobIds,
      capabilityEffects,
    };

    if (skillModal.editingId) {
      await api.patch(`/api/ref-data/skills/${skillModal.editingId}`, payload);
    } else {
      await api.post("/api/ref-data/skills", payload);
    }

    closeSkillModal();
    await fetchAll();
  } finally {
    saving.value = false;
  }
}

async function deleteSkill(item: AdminSkill) {
  if (!confirm(`Delete skill "${item.name}"?`)) return;
  await api.del(`/api/ref-data/skills/${item.id}`);
  await fetchAll();
}

function openAddObjective() {
  objectiveModal.open = true;
  objectiveModal.editingId = null;
  objectiveModal.name = "";
  objectiveModal.description = "";
  objectiveModal.jobDiversityPenalty = 8;
  objectiveModal.potentialGapMultiplier = 1;
  objectiveModal.capabilityWeights = [];
}

function openEditObjective(item: PartyIntent) {
  objectiveModal.open = true;
  objectiveModal.editingId = item.id;
  objectiveModal.name = item.name;
  objectiveModal.description = item.description ?? "";
  objectiveModal.jobDiversityPenalty = item.jobDiversityPenalty;
  objectiveModal.potentialGapMultiplier = Number(item.potentialGapMultiplier ?? 1);
  objectiveModal.capabilityWeights = item.weights.map((entry) => ({
    capabilityId: entry.capabilityId,
    weight: entry.weight,
  }));
}

function closeObjectiveModal() {
  objectiveModal.open = false;
}

function addObjectiveCapabilityWeight() {
  objectiveModal.capabilityWeights.push({ capabilityId: undefined, weight: 0 });
}

function removeObjectiveCapabilityWeight(index: number) {
  objectiveModal.capabilityWeights.splice(index, 1);
}

async function saveObjective() {
  const name = objectiveModal.name.trim();
  if (!name) return;

  const capabilityWeights = Array.from(
    new Map(
      objectiveModal.capabilityWeights
        .filter((entry) => entry.capabilityId !== undefined)
        .map((entry) => [entry.capabilityId as number, {
          capabilityId: entry.capabilityId as number,
          weight: Math.max(0, Math.round(entry.weight || 0)),
        }]),
    ).values(),
  );

  saving.value = true;
  try {
    const payload = {
      name,
      description: objectiveModal.description.trim() || null,
      jobDiversityPenalty: Math.max(0, Math.round(objectiveModal.jobDiversityPenalty || 0)),
      potentialGapMultiplier: Number(objectiveModal.potentialGapMultiplier || 0),
      capabilityWeights,
    };

    if (objectiveModal.editingId) {
      await api.patch(`/api/ref-data/party-intents/${objectiveModal.editingId}`, payload);
    } else {
      await api.post("/api/ref-data/party-intents", payload);
    }

    closeObjectiveModal();
    await fetchAll();
  } finally {
    saving.value = false;
  }
}

async function deleteObjective(item: PartyIntent) {
  if (!confirm(`Delete objective "${item.name}"?`)) return;
  await api.del(`/api/ref-data/party-intents/${item.id}`);
  await fetchAll();
}

function openCapabilityManager() {
  capabilityManagerModalOpen.value = true;
}

function openSkillManager() {
  skillManagerModalOpen.value = true;
}

function openObjectiveManager() {
  objectiveManagerModalOpen.value = true;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <UAlert
      v-if="!props.enabled"
      color="warning"
      variant="soft"
      title="Automatic Party Suggestion is disabled"
      description="You can still configure capabilities, skills, and objectives. Enable PARTY_SUGGESTIONS_ENABLED to use them in party setup."
    />

    <div v-if="loading" class="flex-1 py-10 text-center text-sm text-slate-400">
      Loading automatic suggestion data...
    </div>

    <div v-else-if="isLauncherMode" class="grid grid-cols-1 gap-2">
      <button
        type="button"
        class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-cyan-700/70"
        @click="openCapabilityManager"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Capabilities</p>
          <span class="rounded bg-slate-900 px-2 py-1 text-xs text-cyan-200">{{ capabilities.length }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-400">Manage capability names and descriptions.</p>
      </button>

      <button
        type="button"
        class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-cyan-700/70"
        @click="openSkillManager"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Skills</p>
          <span class="rounded bg-slate-900 px-2 py-1 text-xs text-cyan-200">{{ skills.length }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-400">Manage skills, job links, and capability effectiveness.</p>
      </button>

      <button
        type="button"
        class="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-left transition hover:border-cyan-700/70"
        @click="openObjectiveManager"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Objectives</p>
          <span class="rounded bg-slate-900 px-2 py-1 text-xs text-cyan-200">{{ objectives.length }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-400">Manage objective weights and scoring behavior.</p>
      </button>
    </div>

    <div v-else class="grid min-h-0 flex-1 gap-3 xl:grid-cols-3">
      <div class="flex h-full min-h-0 flex-col">
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Capabilities</p>
          <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddCapability">Add</UButton>
        </div>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in capabilities" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p v-if="item.description" class="text-xs text-slate-400">{{ item.description }}</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditCapability(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteCapability(item)" />
                </div>
              </div>
            </li>
            <li v-if="!capabilities.length" class="text-xs text-slate-500">No capabilities yet.</li>
          </ul>
        </div>
      </div>

      <div class="flex h-full min-h-0 flex-col">
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Skills</p>
          <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddSkill">Add</UButton>
        </div>

        <div class="mb-2 grid gap-2 md:grid-cols-2">
          <UInput
            v-model="skillSearchQuery"
            icon="i-lucide-search"
            size="xs"
            placeholder="Search skills, jobs, capabilities"
          />
          <USelect
            v-model="selectedSkillJobId"
            :items="skillJobFilterOptions"
            value-key="value"
            label-key="label"
            size="xs"
            placeholder="Filter by job"
          />
        </div>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in paginatedSkills" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p class="text-xs text-cyan-300">{{ getSkillJobNames(item) }}</p>
                  <p class="text-xs text-slate-400">{{ item.skillCapabilities.length }} capabilities</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditSkill(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteSkill(item)" />
                </div>
              </div>
            </li>
            <li v-if="!paginatedSkills.length" class="text-xs text-slate-500">No matching skills.</li>
          </ul>
        </div>

        <div v-if="filteredSkills.length" class="mt-2 flex items-center justify-between gap-2 border-t border-slate-800 pt-2">
          <span class="text-xs text-slate-500">Page {{ skillPage }} of {{ totalSkillPages }}</span>
          <div class="flex flex-wrap justify-end gap-1">
            <template v-for="(page, idx) in skillPaginationItems" :key="`skills-full-page-${idx}-${page}`">
              <span v-if="page === 'ellipsis'" class="px-1 text-xs text-slate-500">...</span>
              <UButton
                v-else
                size="xs"
                :color="isSkillPageActive(page) ? 'primary' : 'neutral'"
                :variant="isSkillPageActive(page) ? 'solid' : 'soft'"
                @click="goToSkillPage(page)"
              >
                {{ page }}
              </UButton>
            </template>
          </div>
        </div>
      </div>

      <div class="flex h-full min-h-0 flex-col">
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="font-semibold text-slate-100">Objectives</p>
          <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddObjective">Add</UButton>
        </div>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in objectives" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p class="text-xs text-slate-400">Top weights: {{ topObjectiveWeights(item) || 'None' }}</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditObjective(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteObjective(item)" />
                </div>
              </div>
            </li>
            <li v-if="!objectives.length" class="text-xs text-slate-500">No objectives yet.</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <UModal v-model:open="capabilityManagerModalOpen" :ui="{ content: 'sm:max-w-3xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[75vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-white">Capabilities</span>
            <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddCapability">Add</UButton>
          </div>
        </template>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in capabilities" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p v-if="item.description" class="text-xs text-slate-400">{{ item.description }}</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditCapability(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteCapability(item)" />
                </div>
              </div>
            </li>
            <li v-if="!capabilities.length" class="text-xs text-slate-500">No capabilities yet.</li>
          </ul>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="soft" @click="capabilityManagerModalOpen = false">Close</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="skillManagerModalOpen" :ui="{ content: 'sm:max-w-4xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[75vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <span class="font-semibold text-white">Skills</span>
              <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddSkill">Add</UButton>
            </div>
            <UInput
              v-model="skillSearchQuery"
              icon="i-lucide-search"
              size="sm"
              placeholder="Search skills, jobs, capabilities"
            />
            <USelect
              v-model="selectedSkillJobId"
              :items="skillJobFilterOptions"
              value-key="value"
              label-key="label"
              size="sm"
              placeholder="Filter by job"
            />
          </div>
        </template>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in paginatedSkills" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p class="text-xs text-cyan-300">{{ getSkillJobNames(item) }}</p>
                  <p class="text-xs text-slate-400">{{ item.skillCapabilities.length }} capabilities</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditSkill(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteSkill(item)" />
                </div>
              </div>
            </li>
            <li v-if="!paginatedSkills.length" class="text-xs text-slate-500">No matching skills.</li>
          </ul>
        </div>

        <template #footer>
          <div class="flex items-center justify-between gap-2">
            <div v-if="filteredSkills.length" class="flex items-center gap-2">
              <span class="text-xs text-slate-500">Page {{ skillPage }} of {{ totalSkillPages }}</span>
              <div class="flex flex-wrap gap-1">
                <template v-for="(page, idx) in skillPaginationItems" :key="`skills-modal-page-${idx}-${page}`">
                  <span v-if="page === 'ellipsis'" class="px-1 text-xs text-slate-500">...</span>
                  <UButton
                    v-else
                    size="xs"
                    :color="isSkillPageActive(page) ? 'primary' : 'neutral'"
                    :variant="isSkillPageActive(page) ? 'solid' : 'soft'"
                    @click="goToSkillPage(page)"
                  >
                    {{ page }}
                  </UButton>
                </template>
              </div>
            </div>
            <UButton color="neutral" variant="soft" class="ml-auto" @click="skillManagerModalOpen = false">Close</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="objectiveManagerModalOpen" :ui="{ content: 'sm:max-w-4xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[75vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-white">Objectives</span>
            <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="openAddObjective">Add</UButton>
          </div>
        </template>

        <div class="pr-1">
          <ul class="space-y-2">
            <li v-for="item in objectives" :key="item.id" class="rounded border border-slate-800 px-3 py-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="text-sm text-slate-100">{{ item.name }}</p>
                  <p class="text-xs text-slate-400">Top weights: {{ topObjectiveWeights(item) || 'None' }}</p>
                </div>
                <div class="flex gap-1">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" @click="openEditObjective(item)" />
                  <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteObjective(item)" />
                </div>
              </div>
            </li>
            <li v-if="!objectives.length" class="text-xs text-slate-500">No objectives yet.</li>
          </ul>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="soft" @click="objectiveManagerModalOpen = false">Close</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="capabilityModal.open" :ui="{ content: 'sm:max-w-2xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[80vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <span class="font-semibold text-white">{{ capabilityModal.editingId ? 'Edit Capability' : 'Add Capability' }}</span>
        </template>

        <div class="space-y-3 pr-1">
          <UFormField label="Name" required>
            <UInput v-model="capabilityModal.name" placeholder="Capability name" class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="capabilityModal.description" :rows="3" class="w-full" />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeCapabilityModal">Cancel</UButton>
            <UButton color="primary" :loading="saving" @click="saveCapability">Save</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="skillModal.open" :ui="{ content: 'sm:max-w-3xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[80vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <span class="font-semibold text-white">{{ skillModal.editingId ? 'Edit Skill' : 'Add Skill' }}</span>
        </template>

        <div class="space-y-3 pr-1">
          <UFormField label="Name" required>
            <UInput v-model="skillModal.name" placeholder="Skill name" class="w-full" />
          </UFormField>

          <UFormField label="Job Classes" required>
            <USelect
              v-model="skillModal.jobIds"
              :items="jobClassOptions"
              value-key="value"
              label-key="label"
              placeholder="Select job classes"
              multiple
              class="w-full"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea v-model="skillModal.description" :rows="3" class="w-full" />
          </UFormField>

          <div class="space-y-2 rounded border border-slate-800 p-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Capability Effectiveness</p>
              <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="addSkillCapabilityEffect">Add</UButton>
            </div>

            <div v-for="(entry, index) in skillModal.capabilityEffects" :key="index" class="grid gap-2 md:grid-cols-[1fr_100px_32px]">
              <USelect
                v-model="entry.capabilityId"
                :items="capabilityOptions"
                value-key="value"
                label-key="label"
                placeholder="Capability"
              />
              <UInput v-model.number="entry.effectiveness" type="number" min="0" max="100" step="1" />
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeSkillCapabilityEffect(index)" />
            </div>

            <p v-if="!skillModal.capabilityEffects.length" class="text-xs text-slate-500">No capability links yet.</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeSkillModal">Cancel</UButton>
            <UButton color="primary" :loading="saving" :disabled="!skillModal.name.trim() || !skillModal.jobIds.length" @click="saveSkill">Save</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>

  <UModal v-model:open="objectiveModal.open" :ui="{ content: 'sm:max-w-3xl max-h-[85vh]' }">
    <template #content>
      <UCard
        class="border border-cyan-900/40 bg-slate-950 max-h-[80vh] flex flex-col overflow-hidden"
        :ui="{ header: 'shrink-0', body: 'flex-1 min-h-0 overflow-y-auto', footer: 'shrink-0' }"
      >
        <template #header>
          <span class="font-semibold text-white">{{ objectiveModal.editingId ? 'Edit Objective' : 'Add Objective' }}</span>
        </template>

        <div class="space-y-3 pr-1">
          <UFormField label="Name" required>
            <UInput v-model="objectiveModal.name" placeholder="Objective name" class="w-full" />
          </UFormField>

          <UFormField label="Description">
            <UTextarea v-model="objectiveModal.description" :rows="3" class="w-full" />
          </UFormField>

          <div class="grid gap-3 md:grid-cols-2">
            <UFormField label="Job Diversity Penalty">
              <UInput v-model.number="objectiveModal.jobDiversityPenalty" type="number" min="0" max="100" step="1" />
            </UFormField>
            <UFormField label="Potential Gap Multiplier">
              <UInput v-model.number="objectiveModal.potentialGapMultiplier" type="number" min="0" max="5" step="0.05" />
            </UFormField>
          </div>

          <div class="space-y-2 rounded border border-slate-800 p-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Capability Weights</p>
              <UButton size="xs" icon="i-lucide-plus" color="primary" variant="soft" @click="addObjectiveCapabilityWeight">Add</UButton>
            </div>

            <div v-for="(entry, index) in objectiveModal.capabilityWeights" :key="index" class="grid gap-2 md:grid-cols-[1fr_100px_32px]">
              <USelect
                v-model="entry.capabilityId"
                :items="capabilityOptions"
                value-key="value"
                label-key="label"
                placeholder="Capability"
              />
              <UInput v-model.number="entry.weight" type="number" min="0" max="100" step="1" />
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeObjectiveCapabilityWeight(index)" />
            </div>

            <p v-if="!objectiveModal.capabilityWeights.length" class="text-xs text-slate-500">No weights yet.</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="soft" @click="closeObjectiveModal">Cancel</UButton>
            <UButton color="primary" :loading="saving" :disabled="!objectiveModal.name.trim()" @click="saveObjective">Save</UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
