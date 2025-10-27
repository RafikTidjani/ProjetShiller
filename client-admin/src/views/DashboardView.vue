<template>
  <div class="dashboard">
    <section class="sessions-panel">
      <div class="panel-header">
        <div>
          <h2>Sessions actives</h2>
          <p class="subtitle">
            Indique le prénom de l’apprenant pour piloter le bon appareil.
          </p>
        </div>
        <div class="creator">
          <input
            v-model="newTraineeName"
            type="text"
            maxlength="80"
            placeholder="Prénom de l’apprenant"
          />
          <button class="primary" type="button" :disabled="loading" @click="create">
            <span v-if="loading">Création…</span>
            <span v-else>Nouvelle session</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="upcomingSessions.length" class="session-grid">
        <article
          v-for="session in upcomingSessions"
          :key="session.id"
          class="session-card"
          :class="{ selected: session.id === selectedSessionId }"
          @click="select(session.id)"
        >
          <div class="code">
            <span>Code session</span>
            <strong>{{ session.code }}</strong>
          </div>
          <p class="trainee" v-if="session.traineeName">
            👤 {{ session.traineeName }}
          </p>
          <p class="trainee muted" v-else>
            👤 Apprenant non défini
          </p>

          <ul class="meta">
            <li>
              <span>Expire le</span>
              <time :datetime="session.expiresAt">
                {{ formatDate(session.expiresAt) }}
              </time>
            </li>
            <li>
              <span>Valeurs actuelles</span>
              <div class="values">
                <div>
                  <small>SYS/DIA</small>
                  <strong>{{ session.lastValues?.systolic }} /
                    {{ session.lastValues?.diastolic }}</strong>
                </div>
                <div>
                  <small>FC</small>
                  <strong>{{ session.lastValues?.heartRate }} bpm</strong>
                </div>
                <div>
                  <small>SpO₂</small>
                  <strong>{{ session.lastValues?.spo2 }} %</strong>
                </div>
              </div>
            </li>
          </ul>

          <footer>
            <button
              type="button"
              class="outline"
              @click.stop="select(session.id)"
            >
              Piloter
            </button>
            <button
              type="button"
              class="ghost"
              @click.stop="close(session.id)"
            >
              Clôturer
            </button>
          </footer>
        </article>
      </div>

      <p v-else class="empty">
        Aucune session active. Lance-en une nouvelle pour générer un code.
      </p>
      <div class="control-container">
        <ValueControlPanel
          v-if="selectedSession"
          :session="selectedSession"
          :key="selectedSession.id"
        />
        <div v-else class="placeholder">
          <h3>Sélectionne une session</h3>
          <p>Choisis une session active pour piloter l’appareil en temps réel.</p>
        </div>
      </div>
    </section>

    <section class="history-panel">
      <h3>Sessions clôturées</h3>
      <p v-if="!pastSessions.length" class="empty">
        Les sessions terminées apparaîtront ici.
      </p>
      <ul v-else>
        <li v-for="session in pastSessions" :key="session.id">
          <strong>{{ session.code }}</strong>
          <span>
            {{ formatDate(session.createdAt) }} → {{ formatDate(session.closedAt) }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useSessionsStore } from "../stores/sessions";
import ValueControlPanel from "../components/ValueControlPanel.vue";

const sessions = useSessionsStore();
const { upcomingSessions, pastSessions, loading, error } =
  storeToRefs(sessions);

const selectedSessionId = ref(null);
const selectedSession = ref(null);
const newTraineeName = ref("");

onMounted(() => {
  sessions.fetchSessions();
});

watch(
  upcomingSessions,
  (list) => {
    if (!list.length) {
      selectedSessionId.value = null;
       selectedSession.value = null;
      return;
    }
    if (
      !selectedSessionId.value ||
      !list.some((session) => session.id === selectedSessionId.value)
    ) {
      selectedSessionId.value = list[0].id;
    }
    selectedSession.value =
      list.find((session) => session.id === selectedSessionId.value) ?? null;
  },
  { immediate: true },
);

const create = async () => {
  try {
    const session = await sessions.createSession(newTraineeName.value.trim());
    selectedSessionId.value = session.id;
    selectedSession.value = session;
    newTraineeName.value = "";
  } catch (err) {
    console.error(err);
  }
};

const close = async (sessionId) => {
  await sessions.closeSession(sessionId);
  if (selectedSessionId.value === sessionId) {
    selectedSessionId.value = null;
    selectedSession.value = null;
  }
};

const select = (sessionId) => {
  selectedSessionId.value = sessionId;
  selectedSession.value =
    upcomingSessions.value.find((session) => session.id === sessionId) ?? null;
};

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
};
</script>

<style scoped>
.dashboard {
  display: grid;
  gap: 2rem;
}

.sessions-panel,
.history-panel {
  background: rgba(26, 35, 58, 0.95);
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  padding: 2rem;
  box-shadow: 0 25px 40px rgba(15, 24, 45, 0.4);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.panel-header h2 {
  font-size: 1.4rem;
  margin: 0;
  font-weight: 600;
}

.subtitle {
  margin: 0.35rem 0 0;
  color: rgba(148, 163, 184, 0.7);
  font-size: 0.92rem;
}

.creator {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.creator input {
  background: rgba(15, 24, 45, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  color: #f8fafc;
  min-width: 220px;
}

.creator input:focus {
  outline: 2px solid rgba(59, 130, 246, 0.55);
  border-color: rgba(59, 130, 246, 0.55);
}

.primary {
  border: none;
  border-radius: 999px;
  padding: 0.6rem 1.4rem;
  background: linear-gradient(135deg, #34d399, #059669);
  color: white;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.primary:disabled {
  opacity: 0.6;
  cursor: progress;
}

.primary:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 20px rgba(5, 150, 105, 0.35);
}

.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.session-card {
  background: rgba(15, 24, 45, 0.85);
  border-radius: 16px;
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  cursor: pointer;
  transition: transform 0.1s ease, border-color 0.1s ease,
    box-shadow 0.1s ease;
}

.session-card:hover {
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 15px 25px rgba(15, 24, 45, 0.45);
}

.session-card.selected {
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 20px 35px rgba(37, 99, 235, 0.25);
}

.code {
  display: grid;
  gap: 0.3rem;
}

.code span {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.75);
}

.code strong {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.trainee {
  margin: 0;
  font-size: 1rem;
  color: #f1f5f9;
}

.trainee.muted {
  color: rgba(148, 163, 184, 0.7);
  font-style: italic;
}

.meta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 1rem;
}

.meta span {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(148, 163, 184, 0.7);
}

.values {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
}

.values div {
  display: grid;
  gap: 0.2rem;
}

.values small {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.6);
}

.values strong {
  font-size: 1.1rem;
}

.session-card footer {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.outline,
.ghost {
  border-radius: 999px;
  padding: 0.45rem 1.2rem;
  cursor: pointer;
  background: transparent;
}

.outline {
  border: 1px solid rgba(59, 130, 246, 0.7);
  color: #bfdbfe;
}

.outline:hover {
  background: rgba(59, 130, 246, 0.15);
}

.ghost {
  border: 1px solid rgba(239, 68, 68, 0.7);
  color: #fca5a5;
}

.ghost:hover {
  background: rgba(239, 68, 68, 0.1);
}

.empty {
  color: rgba(148, 163, 184, 0.75);
  margin: 1rem 0 0;
}

.error {
  color: #f87171;
  margin-bottom: 1rem;
}

.history-panel h3 {
  margin-top: 0;
  font-weight: 600;
}

.history-panel ul {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.history-panel li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: rgba(15, 24, 45, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.15);
  font-size: 0.95rem;
}

.control-container {
  margin-top: 2rem;
}

.placeholder {
  text-align: center;
  color: rgba(148, 163, 184, 0.75);
  display: grid;
  gap: 0.6rem;
  padding: 2rem;
  border-radius: 16px;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  background: rgba(15, 24, 45, 0.7);
}

.placeholder h3 {
  margin: 0;
  font-weight: 600;
  color: #e2e8f0;
}

.history-panel {
  margin-top: 2rem;
}
</style>
