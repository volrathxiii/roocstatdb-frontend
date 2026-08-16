<script setup lang="ts">
definePageMeta({ layout: false });

const { auth, login } = useAuth();
const api = useApi();
const router = useRouter();
const config = useRuntimeConfig();

const siteName = computed(() => config.public.siteName || "OUROBOROS");
const siteLogo = computed(() => config.public.siteLogo || "logo1");
const logoSrc = computed(() => {
  const value = siteLogo.value;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/logos/${value}.png`;
});

// ── Step 1 form ──────────────────────────────────────────────────────────────
const form = reactive({ ign: "", playerId: "" });

// ── Step 2 confirmation ──────────────────────────────────────────────────────
type Step = "credentials" | "confirm-new";
const step = ref<Step>("credentials");
const confirmPlayerId = ref("");

const error = ref<string | null>(null);
const loading = ref(false);

const toast = useToast();
const route = useRoute();

onMounted(() => {
  const reason = route.query.reason;
  if (reason === 'inactivity') {
    toast.add({ id: 'session-warning', title: 'Logged out due to inactivity', description: 'Please sign in again.', color: 'warning', icon: 'i-lucide-triangle-alert', duration: 0, ui: { root: 'bg-warning/15', title: 'text-warning', description: 'text-warning/80', icon: 'text-warning' } });
  } else if (reason === 'expired') {
    toast.add({ id: 'session-warning', title: 'Session expired', description: 'Please sign in again.', color: 'warning', icon: 'i-lucide-triangle-alert', duration: 0, ui: { root: 'bg-warning/15', title: 'text-warning', description: 'text-warning/80', icon: 'text-warning' } });
  }
  if (reason) {
    router.replace({ query: {} });
  }
});

onMounted(() => {
  if (auth.value.player) {
    navigateTo(auth.value.isMember ? "/dashboard" : "/applicant");
  }
});

function resetToStep1() {
  step.value = "credentials";
  confirmPlayerId.value = "";
  error.value = null;
}

async function doLogin() {
  loading.value = true;
  try {
    const result = await login({ ign: form.ign.trim(), playerId: form.playerId.trim() });
    toast.remove('session-warning');
    router.push(result.isMember ? "/dashboard" : "/applicant");
  } catch (err: unknown) {
    if (err && typeof err === "object" && "data" in err) {
      const fetchErr = err as { data?: { error?: string } };
      error.value = fetchErr.data?.error ?? "Login failed. Please try again.";
    } else {
      error.value = "Unable to connect to server. Please try again later.";
    }
  } finally {
    loading.value = false;
  }
}

// Step 1 submit: check if player exists first
const handleLogin = async () => {
  error.value = null;

  if (!form.ign.trim() || !form.playerId.trim()) {
    error.value = "Both IGN and Player ID are required.";
    return;
  }

  loading.value = true;
  try {
    const { exists } = await api.get<{ exists: boolean }>("/api/auth/check", { playerId: form.playerId.trim() });
    if (exists) {
      // Known player — log in directly
      await doLogin();
    } else {
      // New player — ask for confirmation
      loading.value = false;
      step.value = "confirm-new";
    }
  } catch {
    loading.value = false;
    error.value = "Unable to connect to server. Please try again later.";
  }
};

// Step 2 submit: confirm Player ID matches, then register + login
const handleConfirm = async () => {
  error.value = null;

  if (!confirmPlayerId.value.trim()) {
    error.value = "Please enter your Player ID to confirm.";
    return;
  }

  if (confirmPlayerId.value.trim() !== form.playerId.trim()) {
    error.value = "Player ID does not match. Please check and try again.";
    return;
  }

  await doLogin();
};
</script>

<template>
  <div class="min-h-screen grid place-items-center p-6">
    <UCard class="w-full max-w-md border border-slate-800/70 backdrop-blur-sm bg-slate-950/70">
      <template #header>
        <div class="space-y-3 text-center">
          <div class="flex justify-center">
            <UAvatar
              :src="logoSrc"
              :alt="siteName"
              icon="i-lucide-image"
              class="h-24 w-24 md:h-28 md:w-28"
            />
          </div>
          <h1 class="text-2xl font-semibold tracking-tight text-white">{{ siteName }}</h1>
          <p class="text-sm text-slate-400">
            {{ step === "credentials" ? "Sign in with your in-game credentials" : "Confirm your new account" }}
          </p>
        </div>
      </template>

      <!-- Step 1: credentials -->
      <form v-if="step === 'credentials'" class="space-y-4" @submit.prevent="handleLogin" novalidate>
        <UFormField label="IGN (In-Game Name)">
          <UInput
            v-model="form.ign"
            placeholder="Enter your IGN"
            autocomplete="username"
            :disabled="loading"
            icon="i-lucide-swords"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Player ID">
          <UInput
            v-model="form.playerId"
            placeholder="Enter your Player ID"
            autocomplete="off"
            :disabled="loading"
            icon="i-lucide-fingerprint"
            size="xl"
            class="w-full"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="error"
        />

        <UButton
          type="submit"
          :loading="loading"
          :disabled="loading"
          block
          size="xl"
          icon="i-lucide-log-in"
        >
          {{ loading ? "Signing in..." : "Sign In" }}
        </UButton>
      </form>

      <!-- Step 2: confirm new account -->
      <form v-else class="space-y-4" @submit.prevent="handleConfirm" novalidate>
        <UAlert
          color="info"
          variant="soft"
          icon="i-lucide-user-plus"
          title="New account"
          description="No account was found for that Player ID. Re-enter your Player ID below to create a new account."
        />

        <UFormField label="Confirm Player ID">
          <UInput
            v-model="confirmPlayerId"
            placeholder="Re-enter your Player ID"
            autocomplete="off"
            :disabled="loading"
            icon="i-lucide-fingerprint"
            size="xl"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="error"
        />

        <UButton
          type="submit"
          :loading="loading"
          :disabled="loading"
          block
          size="xl"
          icon="i-lucide-user-plus"
        >
          {{ loading ? "Creating account..." : "Create Account" }}
        </UButton>

        <UButton
          type="button"
          variant="ghost"
          block
          size="xl"
          icon="i-lucide-arrow-left"
          :disabled="loading"
          @click="resetToStep1"
        >
          Use a different account
        </UButton>
      </form>
    </UCard>
  </div>
</template>
