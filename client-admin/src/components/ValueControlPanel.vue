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
        <span>{{ socketConnected ? 'Connecté' : 'Déconnecté' }}</span>
        <button type="button" class="sensor-btn" @click="toggleSensors">
          Capteurs Pouls/Sat : {{ sensorsOn ? 'ON' : 'OFF' }}
        </button>
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
        <button type="submit" class="save" :disabled="nameSaving || !hasNameChanged">
          <span v-if="nameSaving">Sauvegarde…</span>
          <span v-else>Enregistrer</span>
        </button>
        <button v-if="hasNameChanged && !nameSaving" type="button" class="ghost" @click="resetName">
          Annuler
        </button>
      </div>
      <p v-if="nameFeedback" class="feedback">{{ nameFeedback }}</p>
    </form>

    <div class="cards">
      <!-- Tension -->
      <article class="card" :class="rangeClass('systolic', 'diastolic')">
        <h4>Tension artérielle</h4>
        <div class="values-row">
          <div class="value-block">
            <span>SYS</span>
            <input type="number" :value="localValues.systolic" @input="onInput('systolic', $event.target.value)" />
          </div>
          <div class="value-block">
            <span>DIA</span>
            <input type="number" :value="localValues.diastolic" @input="onInput('diastolic', $event.target.value)" />
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
          <button @click="applyBpPreset(120, 80)">Preset 120/80</button>
          <button @click="applyBpPreset(90, 60)">Preset 90/60</button>
          <button @click="applyBpPreset(160, 100)">Preset 160/100</button>
          <button @click="applyBpPreset(70, 40)">Preset 70/40</button>
        </div>
      </article>

      <!-- Pouls -->
      <article class="card" :class="rangeClass('heartRate')">
        <h4>Fréquence cardiaque</h4>
        <div class="values-row">
          <div class="value-block">
            <span>BPM</span>
            <input type="number" :value="localValues.heartRate" @input="onInput('heartRate', $event.target.value)" />
          </div>
        </div>
        <div class="controls">
          <button v-for="step in steps" :key="'hr-' + step" @click="adjust('heartRate', step)">
            {{ formatStep(step) }}
          </button>
        </div>
      </article>

      <!-- Sat -->
      <article class="card" :class="rangeClass('spo2')">
        <h4>Saturation SpO₂</h4>
        <div class="values-row">
          <div class="value-block">
            <span>%</span>
            <input type="number" :value="localValues.spo2" @input="onInput('spo2', $event.target.value)" />
          </div>
        </div>
        <div class="controls">
          <button v-for="step in steps" :key="'spo-' + step" @click="adjust('spo2', step)">
            {{ formatStep(step) }}
          </button>
        </div>
      </article>
    </div>

    <footer class="panel-footer">
      <div class="messages">
        <p v-if="statusMessage" :class="statusType">{{ statusMessage }}</p>
        <p v-if="hasOutOfRange" class="warning">
          Valeurs hors plage réaliste : ajustez ou assumez pour l’exercice.
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
import { io } from 'socket.io-client'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSessionsStore } from '../stores/sessions'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

const props = defineProps({
  session: {
    type: Object,
    required: true
  }
})

const authStore = useAuthStore()
const sessionsStore = useSessionsStore()

const localValues = reactive({
  systolic: props.session.lastValues?.systolic ?? 120,
  diastolic: props.session.lastValues?.diastolic ?? 80,
  heartRate: props.session.lastValues?.heartRate ?? 70,
  spo2: props.session.lastValues?.spo2 ?? 98
})

const outOfRange = reactive({
  systolic: false,
  diastolic: false,
  heartRate: false,
  spo2: false
})

const steps = [-5, -1, +1, +5]

const statusMessage = ref('')
const statusType = ref('info')
const saving = ref(false)

const socketConnected = ref(false)
let socket

// apprenant
const traineeDraft = ref(props.session.traineeName ?? '')
const nameSaving = ref(false)
const nameFeedback = ref('')
const hasNameChanged = computed(() => traineeDraft.value !== (props.session.traineeName ?? ''))

// capteurs
const sensorsOn = computed(() => props.session.lastValues?.sensorsOn !== false)

const meanArterialPressure = computed(() => {
  const { systolic, diastolic } = localValues
  return Math.round((diastolic * 2 + systolic) / 3)
})

const hasOutOfRange = computed(
  () => outOfRange.systolic || outOfRange.diastolic || outOfRange.heartRate || outOfRange.spo2
)

function connectSocket () {
  disconnectSocket()
  socket = io(API_BASE, { transports: ['websocket'] })
  socket.on('connect', () => {
    socketConnected.value = true
    socket.emit('join-session', { sessionCode: props.session.code })
  })
  socket.on('disconnect', () => {
    socketConnected.value = false
  })
  socket.on('session-values', payload => {
    if (payload.sessionId !== props.session.id) return
    const values = {
      systolic: payload.systolic ?? localValues.systolic,
      diastolic: payload.diastolic ?? localValues.diastolic,
      heartRate: payload.heartRate ?? localValues.heartRate,
      spo2: payload.spo2 ?? localValues.spo2,
      sensorsOn: payload.sensorsOn ?? sensorsOn.value
    }
    Object.assign(localValues, {
      systolic: values.systolic,
      diastolic: values.diastolic,
      heartRate: values.heartRate,
      spo2: values.spo2
    })
    sessionsStore.updateSessionValues(
      props.session.id,
      {
        systolic: values.systolic,
        diastolic: values.diastolic,
        heartRate: values.heartRate,
        spo2: values.spo2,
        sensorsOn: values.sensorsOn
      },
      payload.timestamp || new Date().toISOString()
    )
  })
}

function disconnectSocket () {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

onMounted(connectSocket)
onUnmounted(disconnectSocket)

watch(
  () => props.session.id,
  () => {
    Object.assign(localValues, {
      systolic: props.session.lastValues?.systolic ?? 120,
      diastolic: props.session.lastValues?.diastolic ?? 80,
      heartRate: props.session.lastValues?.heartRate ?? 70,
      spo2: props.session.lastValues?.spo2 ?? 98
    })
    traineeDraft.value = props.session.traineeName ?? ''
    connectSocket()
  }
)

const scheduleSend = (() => {
  let timer = null
  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      forceSend()
      timer = null
    }, 150)
  }
})()

function forceSend () {
  saving.value = true
  statusMessage.value = ''
  const payload = {
    systolic: Number(localValues.systolic),
    diastolic: Number(localValues.diastolic),
    heartRate: Number(localValues.heartRate),
    spo2: Number(localValues.spo2)
  }
  fetch(`${API_BASE}/api/sessions/${props.session.id}/values`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authStore.authHeader
    },
    body: JSON.stringify(payload)
  })
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erreur lors de la transmission')
      }
      statusMessage.value = 'Valeurs transmises'
      statusType.value = 'success'
    })
    .catch(err => {
      statusMessage.value = err.message
      statusType.value = 'error'
    })
    .finally(() => {
      saving.value = false
    })
}

function adjust (field, step) {
  const current = Number(localValues[field])
  localValues[field] = Number.isNaN(current) ? step : current + step
  scheduleSend()
}

function onInput (field, value) {
  const n = Number(value)
  if (Number.isNaN(n)) return
  localValues[field] = n
  scheduleSend()
}

const formatStep = step => (step > 0 ? `+${step}` : `${step}`)

function rangeClass (...fields) {
  const hasWarning = fields.some(field => outOfRange[field])
  return hasWarning ? 'alert' : ''
}

function applyBpPreset (sys, dia) {
  localValues.systolic = sys
  localValues.diastolic = dia
  forceSend()
}

async function toggleSensors () {
  const target = !sensorsOn.value
  try {
    const res = await fetch(`${API_BASE}/api/sessions/${props.session.id}/sensors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authStore.authHeader
      },
      body: JSON.stringify({ sensorsOn: target })
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Impossible de mettre à jour les capteurs')
    }
    const body = await res.json()
    // mettre à jour le store avec les dernières valeurs et le flag
    const v = body.session.lastValues || {}
    sessionsStore.updateSessionValues(
      props.session.id,
      {
        systolic: v.systolic ?? localValues.systolic,
        diastolic: v.diastolic ?? localValues.diastolic,
        heartRate: v.heartRate ?? localValues.heartRate,
        spo2: v.spo2 ?? localValues.spo2,
        sensorsOn: v.sensorsOn
      },
      new Date().toISOString()
    )
  } catch (err) {
    statusMessage.value = err.message
    statusType.value = 'error'
  }
}

function saveTraineeName () {
  if (!hasNameChanged.value) return
  nameSaving.value = true
  nameFeedback.value = ''
  fetch(`${API_BASE}/api/sessions/${props.session.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authStore.authHeader
    },
    body: JSON.stringify({ traineeName: traineeDraft.value })
  })
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Erreur lors de la sauvegarde')
      }
      nameFeedback.value = 'Nom mis à jour.'
    })
    .catch(err => {
      nameFeedback.value = err.message
    })
    .finally(() => {
      nameSaving.value = false
    })
}

function resetName () {
  traineeDraft.value = props.session.traineeName ?? ''
  nameFeedback.value = ''
}

const formatDate = iso =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
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

.status {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.sensor-btn {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: rgba(15, 23, 42, 0.9);
  color: #e2e8f0;
  padding: 0.35rem 0.9rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.indicator {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

.indicator.online {
  background: #34d399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.9);
}

.indicator.offline {
  background: #fbbf24;
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
  flex-wrap: wrap;
  gap: 0.75rem;
}

.editor-row input {
  background: rgba(15, 24, 45, 0.8);
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  padding: 0.5rem 1rem;
  color: #e2e8f0;
  min-width: 220px;
}

.save {
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
  color: #fff;
  padding: 0.5rem 1.3rem;
  font-weight: 600;
  cursor: pointer;
}

.ghost {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.5);
  padding: 0.5rem 1.1rem;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
}

.feedback {
  font-size: 0.85rem;
  color: rgba(96, 165, 250, 0.9);
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

