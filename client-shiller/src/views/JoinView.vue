<template>
  <main class="join-screen">
    <section class="panel">
      <header>
        <h1>Simulateur DEFIGARD</h1>
        <p>Entre le code session fourni par le formateur.</p>
      </header>

      <form @submit.prevent="submit">
        <label for="session-code">Code session</label>
        <input
          id="session-code"
          v-model="code"
          type="text"
          inputmode="numeric"
          pattern="[0-9]{6}"
          maxlength="6"
          placeholder="123456"
          required
        />

        <button type="submit" :disabled="session.loading">
          <span v-if="session.loading">Connexion…</span>
          <span v-else>Rejoindre</span>
        </button>
      </form>

      <p v-if="session.error" class="error">{{ session.error }}</p>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useSessionStore } from "../stores/session";

import { useRouter } from "vue-router";

const session = useSessionStore();
const router = useRouter();
const code = ref("");

session.reset();

const submit = async () => {
  if (!code.value) return;
  try {
    const joined = await session.joinSession(code.value.trim());
    if (joined) {
      router.push({ name: "display", params: { sessionId: joined.id } });
    }
  } catch (err) {
    console.error(err);
  }
};
</script>

<style scoped>
.join-screen {
  width: min(480px, 100%);
}

.panel {
  background: radial-gradient(circle at top, #1a2660, #0a0d14 70%);
  border-radius: 24px;
  padding: 3rem 2.5rem;
  display: grid;
  gap: 1.5rem;
  border: 1px solid rgba(59, 130, 246, 0.35);
  box-shadow: 0 40px 80px rgba(8, 12, 20, 0.6);
}

header h1 {
  margin: 0;
  font-weight: 600;
  letter-spacing: 0.08em;
}

header p {
  margin: 0.75rem 0 0;
  color: rgba(203, 213, 225, 0.85);
}

form {
  display: grid;
  gap: 0.8rem;
}

label {
  font-size: 0.9rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.75);
}

input {
  padding: 0.9rem 1.2rem;
  border-radius: 16px;
  border: 1px solid rgba(96, 165, 250, 0.5);
  background: rgba(15, 23, 42, 0.9);
  color: #f8fafc;
  font-size: 1.4rem;
  letter-spacing: 0.3em;
  text-align: center;
  font-weight: 600;
}

input:focus {
  outline: 2px solid rgba(96, 165, 250, 0.75);
}

button {
  margin-top: 0.5rem;
  border: none;
  border-radius: 16px;
  padding: 0.9rem 1.2rem;
  background: linear-gradient(135deg, #3b82f6, #0ea5e9);
  color: white;
  font-size: 1.1rem;
  letter-spacing: 0.08em;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 15px 30px rgba(14, 165, 233, 0.35);
}

button:disabled {
  opacity: 0.6;
  cursor: progress;
}

.error {
  margin: 0;
  color: #fca5a5;
  font-size: 0.95rem;
}
</style>
