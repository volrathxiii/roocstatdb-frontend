<script setup lang="ts">
definePageMeta({ layout: false });

const { login } = useAuth();
const router = useRouter();

const form = reactive({ ign: "", playerId: "" });
const error = ref<string | null>(null);
const loading = ref(false);

const handleLogin = async () => {
  error.value = null;

  if (!form.ign.trim() || !form.playerId.trim()) {
    error.value = "Both IGN and Player ID are required.";
    return;
  }

  loading.value = true;
  try {
    const result = await login({ ign: form.ign.trim(), playerId: form.playerId.trim() });
    // Redirect based on membership status
    if (result.isMember) {
      router.push("/dashboard");
    } else {
      router.push("/applicant");
    }
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
};
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">ROOC StatDB</h1>
      <p class="login-subtitle">Sign in with your in-game credentials</p>

      <form class="login-form" @submit.prevent="handleLogin" novalidate>
        <div class="field">
          <label for="ign">IGN (In-Game Name)</label>
          <input
            id="ign"
            v-model="form.ign"
            type="text"
            placeholder="Enter your IGN"
            autocomplete="username"
            :disabled="loading"
            required
          />
        </div>

        <div class="field">
          <label for="playerId">Player ID</label>
          <input
            id="playerId"
            v-model="form.playerId"
            type="text"
            placeholder="Enter your Player ID"
            autocomplete="off"
            :disabled="loading"
            required
          />
        </div>

        <p v-if="error" class="error-msg" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading" class="btn-submit">
          {{ loading ? "Signing in…" : "Sign In" }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f172a;
  font-family: system-ui, sans-serif;
}

.login-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.login-title {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: #f1f5f9;
  text-align: center;
}

.login-subtitle {
  margin: 0 0 2rem;
  font-size: 0.875rem;
  color: #94a3b8;
  text-align: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field input {
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 1rem;
  padding: 0.65rem 0.875rem;
  outline: none;
  transition: border-color 0.2s;
}

.field input:focus {
  border-color: #6366f1;
}

.field input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-msg {
  font-size: 0.875rem;
  color: #f87171;
  margin: 0;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.btn-submit {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  margin-top: 0.25rem;
}

.btn-submit:hover:not(:disabled) {
  background: #4f46e5;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
