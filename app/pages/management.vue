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

// ── State ────────────────────────────────────────────────────────────────────
const jobClasses  = ref<RefItem[]>([]);
const classRoles  = ref<RefItem[]>([]);

const modal = reactive({
  open:    false,
  type:    "" as "job-classes" | "class-roles",
  label:   "",
  editing: null as RefItem | null,
  name:    "",
});

// ── Fetch ────────────────────────────────────────────────────────────────────
async function fetchAll() {
  const [j, c] = await Promise.all([
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/job-classes`),
    $fetch<RefItem[]>(`${backendUrl}/api/ref-data/class-roles`),
  ]);
  jobClasses.value  = j;
  classRoles.value  = c;
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
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
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
</template>