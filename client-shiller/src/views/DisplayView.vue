<template>
  <div class="monitor-shell">
    <!-- Top white frame SCHILLER / Touch 7 -->
    <div class="frame-top">
      <span class="frame-brand">SCHILLER</span>
      <span class="frame-model">Touch 7</span>
    </div>

    <!-- Black top bar inside the screen -->
    <header class="monitor-top">
      <div class="top-left">
        <span class="top-icon">☀</span>
        <span class="top-date">{{ today }}</span>
        <span class="top-time">{{ now }}</span>
        <span class="top-label">Rythm.</span>
      </div>
      <div class="top-center">
        <span class="top-center-text">SpO2: Statut de demarrage</span>
        <span class="top-center-bar"></span>
      </div>
      <div class="top-right">
        <span class="top-icon">GSM</span>
        <span class="top-icon">Adulte</span>
        <span class="top-icon">🔋</span>
        <span class="top-icon top-icon--alarm">On</span>
      </div>
    </header>

    <!-- Session info -->
    <section class="monitor-meta" v-if="sessionStore.session">
      <div class="meta-item">
        <span class="meta-label">Code</span>
        <strong>{{ sessionStore.session.code }}</strong>
      </div>
      <div class="meta-item" v-if="sessionStore.session.traineeName">
        <span class="meta-label">Apprenant</span>
        <strong>{{ sessionStore.session.traineeName }}</strong>
      </div>
      <div class="meta-item">
        <span class="meta-label">Expire</span>
        <strong>{{ formattedExpiry }}</strong>
      </div>
    </section>

    <!-- Main screen grid -->
    <main class="monitor-grid" v-if="sessionStore.session">
      <!-- Big pulse area on the left -->
      <section
        class="tile tile--pulse"
        :class="{ 'tile--alert': sessionStore.outOfRange.heartRate }"
      >
        <header class="tile__header">
          <span>Pouls</span>
          <span>b/min</span>
        </header>

        <!-- Vertical scale 120 / 50 -->
        <div class="axis axis--pulse">
          <span>120</span>
          <span>50</span>
        </div>

        <div class="tile__value tile__value--xl">
          <span class="tile__value-main">
            {{ hrSensorOn ? displayValue(displayHeartRate) : '--' }}
          </span>
          <span class="tile__icon">♥</span>
        </div>
      </section>

      <!-- Right column SpO2 / Pulse -->
      <section
        class="tile tile--spo2"
        :class="{ 'tile--alert': sessionStore.outOfRange.spo2 }"
      >
        <header class="tile__header">
          <span>SpO2</span>
          <span>%</span>
        </header>

        <!-- Scale 100 / 92 / 50 -->
        <div class="axis axis--spo2">
          <span>100</span>
          <span>92</span>
          <span>50</span>
        </div>

        <div class="tile__value tile__value--lg">
          <span class="tile__value-main">
            {{ satSensorOn ? displayValue(displaySpo2) : '--' }}
          </span>
        </div>
        <footer class="tile__footer tile__footer--mini">
          Pouls
          <strong>{{ hrSensorOn ? displayValue(displayHeartRate) : '--' }}</strong>
          b/min
        </footer>
      </section>

      <!-- PNI bottom left -->
      <section
        class="tile tile--bp"
        :class="{
          'tile--alert':
            sessionStore.outOfRange.systolic || sessionStore.outOfRange.diastolic
        }"
      >
        <header class="tile__header">
          <span>PNI</span>
          <span>mmHg</span>
        </header>

        <!-- Main PNI block: values, dynamic bar, history -->
        <div class="bp-main">
          <!-- Overlay during measurement -->
          <div v-if="bpMeasuring" class="bp-overlay">
            <div class="cuff">PNI</div>
          </div>

          <!-- Left column: scale and numeric values -->
          <div class="bp-left">
            <div class="bp-scale">
              <span>160</span>
              <span>90</span>
              <span>50</span>
            </div>
            <div class="bp-values">
              <div class="bp-row bp-row--sys">
                <span class="bp-label">SYS</span>
                <strong class="bp-value bp-value--sys">
                  {{ displayValue(lastBp.sys) }}
                </strong>
              </div>
              <div class="bp-row bp-row--dia">
                <span class="bp-label">DIA</span>
                <strong class="bp-value bp-value--dia">
                  {{ displayValue(lastBp.dia) }}
                </strong>
              </div>
              <div class="bp-row bp-row--map">
                <span class="bp-label">(MAP)</span>
                <strong class="bp-value bp-value--map">
                  {{ displayValue(lastBp.map) }}
                </strong>
              </div>
            </div>
          </div>

          <!-- Center column: vertical mmHg bar -->
          <div class="bp-bar-block">
            <div class="bp-bar">
              <div
                class="bp-bar-fill"
                :class="{ 'bp-bar-fill--active': bpMeasuring }"
                :style="{ height: Math.round(bpBarLevel * 100) + '%' }"
              ></div>
            </div>
            <span class="bp-bar-label">
              {{ Math.round(bpBarLevel * 160) }} mmHg
            </span>
          </div>

          <!-- Right column: last 3 measurements history -->
          <div class="bp-history">
            <div class="bp-history-title">SYS/DIA (MAP)</div>
            <div
              v-for="entry in bpHistory"
              :key="entry.id"
              class="bp-history-row"
            >
              <span class="bp-history-time">{{ entry.time }}</span>
              <span class="bp-history-values">
                {{ entry.sys }}/{{ entry.dia }} ({{ entry.map }})
              </span>
            </div>
          </div>
        </div>

        <footer class="tile__footer tile__footer--scale">
          <span class="bp-zero">0 mmHg</span>
        </footer>
      </section>

      <!-- Victim info where Temp is on the real device -->
      <section class="tile tile--info">
        <header class="tile__header">
          <span>Infos victime</span>
          <span>degC</span>
        </header>
        <div class="patient-form">
          <label>
            Nom / Prenom
            <input v-model="patientName" type="text" />
          </label>
          <label>
            Age
            <input v-model="patientAge" type="number" min="0" />
          </label>
          <label>
            Notes
            <textarea v-model="patientNotes" rows="3" />
          </label>
        </div>
      </section>
    </main>

    <!-- Bottom blue menu bar -->
    <section class="monitor-menu">
      <button class="menu-btn">
        <span class="menu-icon">↺</span>
        <span class="menu-label">ECG 12D</span>
      </button>
      <button class="menu-btn">
        <span class="menu-icon">▤</span>
        <span class="menu-label">Evenement</span>
      </button>
      <button class="menu-btn">
        <span class="menu-icon">📷</span>
        <span class="menu-label">Capture</span>
      </button>
      <button class="menu-btn">
        <span class="menu-icon">⚡</span>
        <span class="menu-label">DSA</span>
      </button>
      <button class="menu-btn menu-btn--primary" @click="startBpMeasurement">
        <span class="menu-icon">▶</span>
        <span class="menu-label">Demar.</span>
      </button>
      <button class="menu-btn">
        <span class="menu-icon">⌂</span>
        <span class="menu-label">Menu</span>
      </button>
    </section>

    <!-- Device bottom bar -->
    <footer class="monitor-bottom">
      <span>DEFIGARD</span>
      <button class="mini-btn" @click="toggleBeep">
        Bip : {{ beepOn ? 'ON' : 'OFF' }}
      </button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const today = ref('')
const now = ref('')
let clockTimer

// Sensors (controlled by admin)
const sensorsOn = computed(() => sessionStore.vitals?.sensorsOn ?? true)
const hrSensorOn = computed(() => sensorsOn.value)
const satSensorOn = computed(() => sensorsOn.value)

// Jitter around target values
const displayHeartRate = ref(null)
const displaySpo2 = ref(null)
let jitterTimer

// Beep
const beepOn = ref(true)
let audioCtx
let beepTimeout

// Blood pressure
const bpMeasuring = ref(false)
const bpMeasured = ref(false)
const bpProgress = ref(0)
const lastBp = ref({ sys: null, dia: null, map: null })
const bpBarLevel = ref(0) // 0..1 for bar height
const bpHistory = ref([]) // last 3 measurements

// Victim info (local only)
const patientName = ref('')
const patientAge = ref('')
const patientNotes = ref('')

const formattedExpiry = computed(() => {
  if (!sessionStore.session?.expiresAt) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(sessionStore.session.expiresAt))
})

function updateClock () {
  const d = new Date()
  today.value = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(d)
  now.value = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

const displayValue = v => (v === null || v === undefined ? '--' : v)

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 30_000)
  startJitter()

  // Try to enable beep early (some browsers require interaction)
  try {
    ensureAudio()
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    scheduleBeep()
  } catch {}

  const resume = async () => {
    try {
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume()
      }
      scheduleBeep()
    } catch {}
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
  }

  window.addEventListener('pointerdown', resume, { once: true })
  window.addEventListener('keydown', resume, { once: true })
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  stopJitter()
  stopBeep()
})

// If session expires, go to ended screen
watch(
  () => sessionStore.expired,
  v => {
    if (v) router.push({ name: 'ended' })
  }
)

// When backend sends new vitals
watch(
  () => sessionStore.vitals,
  v => {
    if (!v) return
    if (v.heartRate !== undefined && v.heartRate !== null) {
      const hr = Math.max(0, v.heartRate)
      displayHeartRate.value = hr
    }
    if (v.spo2 !== undefined && v.spo2 !== null) {
      const spo = Math.min(100, Math.max(0, v.spo2))
      displaySpo2.value = spo
    }
  },
  { deep: true }
)

function startJitter () {
  const hrAmp = 2
  const spoAmp = 0.5
  const hrPeriod = 5000
  const spoPeriod = 8000
  const hrPhase = Math.random() * Math.PI * 2
  const spoPhase = Math.random() * Math.PI * 2

  jitterTimer = setInterval(() => {
    const v = sessionStore.vitals || {}
    const t = Date.now()
    const baseHr = Math.max(0, v.heartRate ?? 60)
    const baseSpo = Math.min(100, Math.max(0, v.spo2 ?? 98))

    if (hrSensorOn.value && baseHr > 0) {
      const hr =
        baseHr + hrAmp * Math.sin(((t + hrPhase) / hrPeriod) * 2 * Math.PI)
      displayHeartRate.value = Math.max(0, Math.round(hr))
    } else {
      displayHeartRate.value = baseHr
    }

    if (satSensorOn.value) {
      const spo =
        baseSpo + spoAmp * Math.sin(((t + spoPhase) / spoPeriod) * 2 * Math.PI)
      displaySpo2.value = Math.min(100, Math.max(0, Math.round(spo)))
    } else {
      displaySpo2.value = baseSpo
    }
  }, 400)
}

function stopJitter () {
  if (jitterTimer) clearInterval(jitterTimer)
}

function ensureAudio () {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtx = new Ctx()
  }
}

function playBeep () {
  try {
    ensureAudio()
    const v = sessionStore.vitals || {}
    const baseHr = Math.max(0, v.heartRate ?? 60)
    if (!hrSensorOn.value || baseHr <= 0) return

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.value = 0.0001
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(
      0.2,
      audioCtx.currentTime + 0.01
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.currentTime + 0.12
    )
    osc.stop(audioCtx.currentTime + 0.13)
  } catch {}
}

function scheduleBeep () {
  if (!beepOn.value) return
  if (beepTimeout) clearTimeout(beepTimeout)
  const v = sessionStore.vitals || {}
  const baseHr = Math.max(0, v.heartRate ?? 60)
  if (!hrSensorOn.value || baseHr <= 0) return

  const interval = Math.max(
    300,
    Math.min(2000, Math.round(60000 / baseHr))
  )
  beepTimeout = setTimeout(() => {
    playBeep()
    scheduleBeep()
  }, interval)
}

function stopBeep () {
  if (beepTimeout) clearTimeout(beepTimeout)
}

function toggleBeep () {
  beepOn.value = !beepOn.value
  if (beepOn.value) {
    ensureAudio()
    scheduleBeep()
  } else {
    stopBeep()
  }
}

function startBpMeasurement () {
  if (bpMeasuring.value) return
  bpMeasured.value = false
  bpMeasuring.value = true
  bpProgress.value = 0
  bpBarLevel.value = 0

  const start = Date.now()
  const total = 15000 // ~15 s, slower like a real cuff

  const id = setInterval(() => {
    const elapsed = Date.now() - start
    const progress = Math.min(1, elapsed / total)
    bpProgress.value = progress * 100

    // During measurement, animate the bar up then slightly down
    const phase = progress < 0.5 ? progress * 2 : (1 - progress) * 2
    bpBarLevel.value = Math.max(0, Math.min(1, phase))

    if (elapsed >= total) {
      clearInterval(id)
      bpMeasuring.value = false
      bpMeasured.value = true
      bpProgress.value = 100

      const v = sessionStore.vitals || {}
      const sys = v.systolic ?? null
      const dia = v.diastolic ?? null
      const map =
        sys != null && dia != null ? Math.round((dia * 2 + sys) / 3) : null
      lastBp.value = { sys, dia, map }

      // Set final bar level based on SYS
      if (sys != null) {
        bpBarLevel.value = Math.max(0, Math.min(1, sys / 160))
      }

      // Add to history (last 3)
      const time = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date())
      const entry = {
        id: Date.now(),
        time,
        sys: sys ?? '--',
        dia: dia ?? '--',
        map: map ?? '--'
      }
      bpHistory.value = [entry, ...bpHistory.value].slice(0, 3)
    }
  }, 100)
}

function restartBp () {
  startBpMeasurement()
}

// If vitals change, next measurement will pick new tension values
watch(
  () => sessionStore.vitals,
  () => {},
  { deep: true }
)
</script>

<style scoped>
.monitor-shell {
  width: 1400px;
  max-width: 98vw;
  min-height: min(820px, 92vh);
  background: #e3e6ec;
  border-radius: 24px;
  border: 4px solid #cbd0da;
  padding: 1.2rem 1.8rem 1.4rem;
  display: grid;
  gap: 0.6rem;
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.25),
    0 30px 80px rgba(0, 0, 0, 0.6);
  color: #e5edf8;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.frame-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 0.2rem;
  color: #111827;
  font-size: 0.95rem;
}

.frame-brand {
  color: #dc2626;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.frame-model {
  font-weight: 500;
}

.monitor-top {
  margin-top: 0.1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #02020a;
  border-radius: 10px;
  padding: 0.25rem 0.8rem;
  color: #f9fafb;
}

.top-left,
.top-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.top-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  font-size: 0.85rem;
}

.top-center-text {
  font-weight: 600;
}

.top-center-bar {
  width: 80px;
  height: 4px;
  background: #ef4444;
  border-radius: 999px;
}

.top-icon--alarm {
  background: #f97316;
  color: #111827;
  border-radius: 4px;
  padding: 0 0.2rem;
}

.monitor-meta {
  margin-top: 0.2rem;
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  background: #020516;
  border-radius: 6px;
  padding: 0.45rem 0.8rem;
  border: 1px solid #020516;
  font-size: 0.9rem;
}

.meta-item {
  display: flex;
  gap: 0.45rem;
  align-items: baseline;
}

.meta-label {
  text-transform: uppercase;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.9);
}

.monitor-grid {
  margin-top: 0.1rem;
  background: #050a24;
  border-radius: 6px;
  padding: 0.6rem;
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1.3fr 1.2fr;
  gap: 0.4rem;
}

.tile {
  position: relative;
  border-radius: 2px;
  padding: 0.6rem 0.8rem;
  display: grid;
  gap: 0.4rem;
  color: #f9fafb;
  box-shadow: none;
}

.tile--pulse {
  background: #726bf4;
}

.tile--spo2 {
  background: #726bf4;
}

.tile--bp {
  grid-row: 2 / span 1;
  grid-column: 1 / span 1;
  background: #4d475f;
}

.tile--info {
  grid-row: 2 / span 1;
  grid-column: 2 / span 1;
  background: #4d475f;
}

.tile--alert {
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.8);
}

.tile__header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.9);
}

.tile__value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-weight: 700;
  line-height: 1;
}

.tile__value-main {
  text-shadow: 0 0 6px rgba(15, 23, 42, 0.8);
}

.tile__value--xl {
  font-size: clamp(4.2rem, 7.2vw, 5.6rem);
}

.tile__value--lg {
  font-size: clamp(3rem, 5.5vw, 4.4rem);
}

.tile__icon {
  font-size: clamp(2.2rem, 4vw, 3rem);
  opacity: 0.9;
}

.tile__footer {
  font-size: 0.8rem;
  color: rgba(203, 213, 225, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tile__footer--mini {
  gap: 0.45rem;
}

.axis {
  position: absolute;
  left: 0.3rem;
  top: 2.3rem;
  bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 0.75rem;
  color: rgba(15, 23, 42, 0.9);
  font-weight: 600;
}

.axis--spo2 {
  top: 2.1rem;
}

.tile--spo2 .axis {
  color: rgba(15, 23, 42, 0.9);
}

/* PNI layout */
.bp-main {
  position: relative;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 1.6fr;
  gap: 0.8rem;
  margin-top: 0.2rem;
}

.bp-left {
  display: flex;
  gap: 0.6rem;
}

.bp-scale {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #e5e7eb;
}

/* Arrange SYS / DIA / MAP like on the real PNI: SYS top-left, DIA top-right, MAP bottom-left */
.bp-values {
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  column-gap: 1.2rem;
  row-gap: 0.3rem;
}

.bp-row {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
}

.bp-row--sys {
  grid-column: 1;
  grid-row: 1;
}

.bp-row--dia {
  grid-column: 2;
  grid-row: 1;
}

.bp-row--map {
  grid-column: 1;
  grid-row: 2;
}

.bp-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: rgba(229, 231, 235, 0.9);
}

.bp-value {
  font-size: 1.8rem;
}

.bp-value--sys {
  color: #e6ff5a;
}

.bp-value--dia {
  color: #ffe97a;
}

.bp-value--map {
  color: #e6ff5a;
}

.bp-bar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.bp-bar {
  width: 18px;
  height: 110px;
  background: #000000;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column-reverse;
  overflow: hidden;
}

.bp-bar-fill {
  width: 100%;
  background: #22c55e;
  height: 0%;
  transition: height 0.15s linear;
}

.bp-bar-fill--active {
  background: #f97316;
}

.bp-bar-label {
  font-size: 0.72rem;
  color: #e5e7eb;
}

.bp-history {
  display: grid;
  gap: 0.15rem;
  font-size: 0.72rem;
}

.bp-history-title {
  font-weight: 600;
  letter-spacing: 0.08em;
}

.bp-history-row {
  display: flex;
  gap: 0.4rem;
}

.bp-history-time {
  width: 46px;
}

.bp-history-values {
  flex: 1;
}

.bp-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  gap: 0.6rem;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 2px;
  z-index: 10;
}

.bp-overlay .cuff {
  font-size: 1rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.bp-zero {
  font-size: 0.72rem;
  color: #e5e7eb;
}

.btn,
.mini-btn {
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: #020516;
  color: #e2e8f0;
  padding: 0.35rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn:hover,
.mini-btn:hover {
  background: #1d4ed8;
}

.patient-form {
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
}

.patient-form label {
  display: grid;
  gap: 0.2rem;
}

.patient-form input,
.patient-form textarea {
  background: #020516;
  border-radius: 4px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  color: #e2e8f0;
  padding: 0.3rem 0.5rem;
}

.monitor-menu {
  margin-top: 0.1rem;
  background: #1742d1;
  border-radius: 6px;
  padding: 0.25rem 0.4rem;
  display: flex;
  justify-content: space-between;
  gap: 0.3rem;
}

.menu-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: #e5e7eb;
  font-size: 0.78rem;
  cursor: pointer;
}

.monitor-bottom {
  margin-top: 0.2rem;
  display: flex;
  justify-content: center;
  gap: 1.1rem;
  font-size: 1.05rem;
  letter-spacing: 0.2em;
  color: rgba(55, 65, 81, 1);
}

@media (max-width: 1080px) {
  .monitor-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, minmax(220px, auto));
  }

  .tile--bp,
  .tile--info {
    grid-row: auto;
    grid-column: auto;
  }
}
</style>
