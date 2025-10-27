<template>
  <div class="app-shell">
    <header class="app-header">
      <h1>Shiller Trainer – Admin</h1>
      <nav v-if="isAuthenticated">
        <button type="button" class="text-button" @click="logout">
          Déconnexion
        </button>
      </nav>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { storeToRefs } from "pinia";
import { useAuthStore } from "./stores/auth";
import { useSessionsStore } from "./stores/sessions";

const authStore = useAuthStore();
const sessionsStore = useSessionsStore();
const { isAuthenticated } = storeToRefs(authStore);

const logout = () => {
  sessionsStore.clear();
  authStore.logout();
};
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #0f182d;
  color: #f1f5f9;
  font-family: "Inter", "Segoe UI", system-ui, sans-serif;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: rgba(15, 24, 45, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.app-header h1 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0;
}

.text-button {
  background: none;
  border: none;
  color: #38bdf8;
  font: inherit;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
}

.text-button:hover {
  text-decoration: underline;
}

main {
  padding: 2rem;
}
</style>
