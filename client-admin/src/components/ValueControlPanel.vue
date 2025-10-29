<template>
<section class="control-panel" v-if="session">
    <header>
      <div>
        <h3>Contrôle en temps réel</h3>
        <p>
          Appareil code <strong>{{ session.code }}</strong> — expire le
          <time :datetime="session.expiresAt">{{ formatDate(session.expiresAt) }}</time>
        </p>
      </div>
      <div class="status">
        <span :class="['indicator', socketConnected ? 'online' : 'offline']"></span>
        <span>{{ socketConnected ? "Connecté" : "Déconnecté" }}</span>
      </div>
    </header>

    <form class="trainee-editor" @submit.prevent="saveTraineeName">
      <label for="trainee-name">Apprenant</label>
      <div class="editor-row">
        <input
          id="trainee-name"
          v-model="traineeDraft"
          type="text"
          maxlength="80"
          placeholder="Prénom ou surnom"
        />
        <button
          type="submit"
          class="save"
          :disabled="nameSaving || !hasNameChanged"
        >
          <span v-if="nameSaving">Sauvegarde…</span>
          <span v-else>Enregistrer</span>
        </button>
        <button
          v-if="hasNameChanged && !nameSaving"
          type="button"
          class="ghost"
          @click="resetName"
        >
          Annuler
        </button>
      </div>
      <p v-if="nameFeedback" class="feedback">{{ nameFeedback }}</p>
    </form>

    <div class="cards">
      <article class="card" :class="rangeClass('systolic', 'diastolic')">
        <h4>Tension artérielle</h4>
        <div class="values-row">
          <div class="value-block">
            <span>SYS</span>
            <input
              type="number"
              :value="localValues.systolic"
              @input="onInput('systolic', $event.target.value)"
            />
          </div>
          <div class="value-block">
            <span>DIA</span>
            <input
              type="number"
              :value="localValues.diastolic"
              @input="onInput('diastolic', $event.target.value)"
            />
          </div>
          <div class="value-block map">
            <span>MAP (calc.)</span>
            <strong>{{ meanArterialPressure }}</strong>
          </div>
        </div>
        <div class="controls">
          <button v-for="step in steps" :key="'sys-' + step" @click="adjust('systolic', step)">
            {{ formatStep(step) }} SYS
          </button>
          <button v-for="step in steps" :key="'dia-' + step" @click="adjust('diastolic', step)">
            {{ formatStep(step) }} DIA
          </button>
        </div>
        <div class="controls">
          <button @click="applyBpPreset(120,80)">Preset 120/80</button>
          <button @click="applyBpPreset(90,60)">Preset 90/60</button>
          <button @click="applyBpPreset(160,100)">Preset 160/100</button>
          <button @click="applyBpPreset(70,40)">Preset 70/40</button>
        </div>
      </article>

      <article class="card" :class="rangeClass('heartRate')">
        <h4>Fréquence cardiaque</h4>
        <div class="values-row">
          <div class="value-block">
            <span>BPM</span>
            <input
              type="number"
              :value="localValues.heartRate"
              @input="onInput('heartRate', $event.target.value)"
            />
          </div>
        </div>
        <div class="controls">
          <button v-for="step in steps" :key="'hr-' + step" @click="adjust('heartRate', step)">
            {{ formatStep(step) }}
          </button>
        </div>
      </article>

      <article class="card" :class="rangeClass('spo2')">
        <h4>Saturation SpO₂</h4>
        <div class="values-row">
          <div class="value-block">
            <span>%</span>
            <input
              type="number"
              :value="localValues.spo2"
              @input="onInput('spo2', $event.target.value)"
            />
          </div>
        </div>
        <div class="controls">
          <button v-for="step in [ -5, -1, +1, +5 ]" :key="'spo-' + step" @click="adjust('spo2', step)">
            {{ formatStep(step) }}
          </button>
        </div>
      </article>
    </div>

    <footer class="panel-footer">
      <div class="messages">
        <p v-if="statusMessage" :class="statusType">{{ statusMessage }}</p>
        <p v-if="hasOutOfRange" class="warning">
          ⚠️ Valeurs hors plage réaliste : ajustez ou assumez pour l’exercice.
        </p>
      </div>
      <button class="secondary" type="button" :disabled="saving" @click="forceSend">
        <span v-if="saving">Transmission…</span>
        <span v-else>Transmettre maintenant</span>
      </button>
    </footer>
  </section>
</template>

<script setup>
import { io } from "socket.io-client";
import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useAuthStore } from "../stores/auth";
import { useSessionsStore } from "../stores/sessions";

const props = defineProps({
  session: {
    type: Object,
    required: true,
  },
});

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const authStore = useAuthStore();
const sessionsStore = useSessionsStore();

const localValues = reactive({
  systolic: props.session.lastValues?.systolic ?? 120,
  diastolic: props.session.lastValues?.diastolic ?? 80,
  heartRate: props.session.lastValues?.heartRate ?? 70,
  spo2: props.session.lastValues?.spo2 ?? 98,
});

const outOfRange = reactive({
  systolic: false,
  diastolic: false,
  heartRate: false,
  spo2: false,
});

const steps = [-5, -1, +1, +5];
const statusMessage = ref("");
const statusType = ref("info");
const saving = ref(false);
const socketConnected = ref(false);
const traineeDraft = ref(props.session.traineeName ?? "");
const nameSaving = ref(false);
const nameFeedback = ref("");
const hasNameChanged = computed(
  () => traineeDraft.value.trim() !== (props.session.traineeName ?? ""),
);
let socket;
let debounceTimer = null;

const meanArterialPressure = computed(() => {
  const { systolic, diastolic } = localValues;
  return Math.round((diastolic * 2 + systolic) / 3);
});

const hasOutOfRange = computed(() =>
  Object.values(outOfRange).some((value) => value),
);

const setValues = (values) => {
  localValues.systolic = Math.round(values.systolic);
  localValues.diastolic = Math.round(values.diastolic);
  localValues.heartRate = Math.round(values.heartRate);
  localValues.spo2 = Math.round(values.spo2);
};

const setOutOfRange = (ranges) => {
  if (!ranges) return;
  Object.assign(outOfRange, ranges);
};

const connectSocket = () => {
  disconnectSocket();
  socket = io(API_BASE, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    socketConnected.value = true;
    socket.emit("join-session", { sessionCode: props.session.code });
  });

  socket.on("disconnect", () => {
    socketConnected.value = false;
  });

  socket.on("session-values", (payload) => {
    if (payload.sessionId !== props.session.id) return;
    setValues(payload);
    setOutOfRange(payload.outOfRange);
    sessionsStore.updateSessionValues(
      props.session.id,
      {
        systolic: payload.systolic,
        diastolic: payload.diastolic,
        heartRate: payload.heartRate,
        spo2: payload.spo2,
      },
      payload.timestamp,
    );
  });

  socket.on("session-expired", (payload) => {
    if (payload.sessionId && payload.sessionId !== props.session.id) return;
    statusMessage.value = "Session expirée.";
    statusType.value = "warning";
    sessionsStore.markSessionClosed(props.session.id, payload.reason);
  });
};

const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

onUnmounted(disconnectSocket);

watch(
  () => props.session.id,
  () => {
    setValues(props.session.lastValues ?? {});
    traineeDraft.value = props.session.traineeName ?? "";
    nameFeedback.value = "";
    connectSocket();
  },
  { immediate: true },
);

watch(
  () => props.session.lastValues,
  (values) => {
    if (!values) return;
    setValues(values);
  },
  { deep: true },
);

watch(
  () => props.session.traineeName,
  (value) => {
    traineeDraft.value = value ?? "";
  },
);

const resetName = () => {
  traineeDraft.value = props.session.traineeName ?? "";
  nameFeedback.value = "";
};

const saveTraineeName = async () => {
  if (!hasNameChanged.value) return;
  nameSaving.value = true;
  nameFeedback.value = "";
  try {
    const updated = await sessionsStore.updateTraineeName(
      props.session.id,
      traineeDraft.value.trim(),
    );
    nameFeedback.value = updated.traineeName
      ? "Prénom mis à jour."
      : "Prénom effacé.";
  } catch (err) {
    nameFeedback.value = err.message;
    traineeDraft.value = props.session.traineeName ?? "";
  } finally {
    nameSaving.value = false;
  }
};

const scheduleSend = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    forceSend();
  }, 120);
};

const payloadForSend = () => ({
  systolic: Number(localValues.systolic),
  diastolic: Number(localValues.diastolic),
  heartRate: Number(localValues.heartRate),
  spo2: Number(localValues.spo2),
});

const forceSend = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  saving.value = true;
  statusMessage.value = "";
  try {
    const response = await fetch(
      `${API_BASE}/api/sessions/${props.session.id}/values`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authStore.authHeader,
        },
        body: JSON.stringify(payloadForSend()),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Erreur lors de l'envoi des valeurs");
    }
    statusMessage.value = "Valeurs transmises";
    statusType.value = "success";
  } catch (err) {
    statusMessage.value = err.message;
    statusType.value = "error";
  } finally {
    saving.value = false;
  }
};

const adjust = (field, step) => {
  const nextValue = Number(localValues[field]) + step;
  localValues[field] = Math.round(nextValue);
  scheduleSend();
};

const onInput = (field, value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return;
  localValues[field] = numeric;
  scheduleSend();
};

  const formatStep = (step) => (step > 0 ? `+${step}` : `${step}`);

  const rangeClass = (...fields) => {
    const hasWarning = fields.some((field) => outOfRange[field]);
    return hasWarning ? "alert" : "";
  };

  const applyBpPreset = (sys, dia) => {
    localValues.systolic = sys;
    localValues.diastolic = dia;
    forceSend();
  };

const formatDate = (iso) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
</script>

<style scoped>
.control-panel {
  background: rgba(15, 24, 45, 0.92);
  border-radius: 20px;
  border: 1px solid rgba(59, 130, 246, 0.25);
  padding: 2rem;
  display: grid;
  gap: 2rem;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

header h3 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

header p {
  margin: 0.25rem 0 0;
  color: rgba(148, 163, 184, 0.8);
}

.trainee-editor {
  display: grid;
  gap: 0.5rem;
}

.trainee-editor label {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.7);
}

.editor-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.editor-row input {
  flex: 1 1 220px;
  background: rgba(15, 24, 45, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.35);
  border-radius: 999px;
  padding: 0.55rem 1rem;
  color: #f8fafc;
}

.editor-row input:focus {
  outline: 2px solid rgba(59, 130, 246, 0.55);
}

.save {
  border: none;
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.trainee-editor .ghost {
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 999px;
  padding: 0.5rem 1.1rem;
  background: transparent;
  color: rgba(226, 232, 240, 0.85);
  cursor: pointer;
}

.trainee-editor .ghost:hover {
  background: rgba(148, 163, 184, 0.1);
}

.feedback {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(96, 165, 250, 0.9);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: rgba(148, 163, 184, 0.8);
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
  background: rgba(148, 163, 184, 0.5);
}

.indicator.online {
  background: #34d399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.8);
}

.indicator.offline {
  background: #fbbf24;
}

.cards {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.card {
  background: rgba(26, 35, 58, 0.95);
  border-radius: 18px;
  padding: 1.5rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  display: grid;
  gap: 1.2rem;
}

.card.alert {
  border-color: rgba(248, 113, 113, 0.65);
  box-shadow: 0 0 25px rgba(248, 113, 113, 0.25);
}

.card h4 {
  margin: 0;
  font-size: 1.1rem;
}

.values-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.value-block {
  display: grid;
  gap: 0.4rem;
  min-width: 100px;
}

.value-block span {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(148, 163, 184, 0.7);
}

input {
  background: rgba(15, 24, 45, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
  padding: 0.6rem 0.8rem;
  font-size: 1.2rem;
  color: #f8fafc;
}

input:focus {
  outline: 2px solid rgba(59, 130, 246, 0.45);
}

.value-block.map strong {
  font-size: 1.4rem;
  letter-spacing: 0.04em;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.controls button {
  border: none;
  background: rgba(59, 130, 246, 0.15);
  color: #bfdbfe;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  cursor: pointer;
  transition: background 0.1s ease;
}

.controls button:hover {
  background: rgba(59, 130, 246, 0.3);
}

.panel-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.messages {
  display: grid;
  gap: 0.4rem;
}

.info {
  color: #bfdbfe;
}

.success {
  color: #4ade80;
}

.error {
  color: #f87171;
}

.warning {
  color: #fbbf24;
}

.secondary {
  background: transparent;
  border: 1px solid rgba(59, 130, 246, 0.6);
  color: #bfdbfe;
  border-radius: 999px;
  padding: 0.55rem 1.4rem;
  cursor: pointer;
}

.secondary:disabled {
  opacity: 0.6;
  cursor: progress;
}
</style>
