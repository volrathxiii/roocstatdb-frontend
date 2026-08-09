<script setup lang="ts">
definePageMeta({ layout: false });

const { auth, logout } = useAuth();

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.value.player) navigateTo("/login");
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <span class="brand">ROOC StatDB</span>
      <button class="btn-logout" @click="logout">Logout</button>
    </header>

    <main class="content">
      <div class="welcome-card">
        <div class="badge member">Member</div>
        <h1>Welcome, {{ auth.player?.ign }}!</h1>
        <p>Player ID: <strong>{{ auth.player?.playerId }}</strong></p>
        <p>Your membership is active. Dashboard coming soon.</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; background: #0f172a; font-family: system-ui, sans-serif; color: #f1f5f9; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; background: #1e293b; border-bottom: 1px solid #334155; }
.brand { font-size: 1.25rem; font-weight: 700; }
.btn-logout { background: transparent; border: 1px solid #475569; color: #94a3b8; border-radius: 6px; padding: 0.4rem 1rem; cursor: pointer; }
.btn-logout:hover { border-color: #6366f1; color: #f1f5f9; }
.content { display: flex; align-items: center; justify-content: center; padding: 4rem 1rem; }
.welcome-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2.5rem; text-align: center; max-width: 480px; width: 100%; }
.welcome-card h1 { font-size: 1.75rem; margin: 0.75rem 0 0.5rem; }
.welcome-card p { color: #94a3b8; margin: 0.5rem 0; }
.badge { display: inline-block; padding: 0.3rem 0.9rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
.badge.member { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); }
</style>
