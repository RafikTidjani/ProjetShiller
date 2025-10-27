<template>
  <section class="login-container">
    <div class="panel">
      <h2>Connexion formateur</h2>
      <p class="hint">
        Identifiants démo : <code>formateur@demo.fr</code> / <code>demo123</code>
      </p>

      <form @submit.prevent="submit">
        <label>
          Email
          <input
            v-model="email"
            type="email"
            autocomplete="username"
            required
            placeholder="formateur@demo.fr"
          />
        </label>

        <label>
          Mot de passe
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="••••••"
          />
        </label>

        <button class="primary" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading">Connexion…</span>
          <span v-else>Se connecter</span>
        </button>
      </form>

      <p v-if="auth.error" class="error">{{ auth.error }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const email = ref("formateur@demo.fr");
const password = ref("demo123");

const submit = () => {
  if (!email.value || !password.value) return;
  auth.login(email.value, password.value);
};
</script>

<style scoped>
.login-container {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel {
  width: min(360px, 90vw);
  background: rgba(26, 35, 58, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 30px 50px rgba(15, 24, 45, 0.5);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.panel h2 {
  font-size: 1.5rem;
  margin: 0;
  font-weight: 600;
}

form {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.95rem;
}

input {
  background: rgba(15, 24, 45, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  padding: 0.7rem 0.9rem;
  font-size: 1rem;
  color: #e2e8f0;
}

input:focus {
  outline: 2px solid rgba(56, 189, 248, 0.6);
  border-color: rgba(56, 189, 248, 0.6);
}

.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.25rem;
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: white;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.primary:disabled {
  opacity: 0.6;
  cursor: progress;
}

.primary:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.35);
}

.hint {
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.9);
}

.hint code {
  background: rgba(15, 24, 45, 0.6);
  padding: 0 0.25rem;
  border-radius: 4px;
}

.error {
  color: #f87171;
  font-size: 0.9rem;
  margin: 0;
}
</style>
