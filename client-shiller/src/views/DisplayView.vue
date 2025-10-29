<template>
  <div class="monitor-shell">
    <header class="monitor-top">
      <div class="brand">
        <span class="brand__name">SCHILLER</span>
        <span class="brand__model">Touch 7</span>
      </div>
      <div class="toolbar">
        <span class="toolbar__clock">{{ now }}</span>
        <span class="toolbar__link" :class="sessionStore.socketConnected ? 'link--ok' : 'link--down'">
          {{ sessionStore.socketConnected ? 'Lien OK' : 'Lien perdu' }}
        </span>
      </div>
    </header>

    <section class="monitor-meta">
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

    <main class="monitor-grid">
      <!-- Pouls -->
      <section class="tile tile--pulse" :class="{ 'tile--alert': sessionStore.outOfRange.heartRate }">
        <header class="tile__header"><span>Pouls</span><span>b/min</span></header>
        <div class="tile__value tile__value--xl">
          <span>{{ displayValue(displayHeartRate) }}</span>
          <span class="tile__icon">❤</span>
        </div>
        <footer class="tile__footer tile__footer--wave">
          <span>Rythm.</span>
          <span class="wave"></span>
        </footer>
      </section>

      <!-- SpO2 -->
      <section class="tile tile--spo2" :class="{ 'tile--alert': sessionStore.outOfRange.spo2 }">
        <header class="tile__header"><span>SpO2</span><span>%</span></header>
        <div class="tile__value tile__value--lg">
          <span>{{ displayValue(displaySpo2) }}</span>
        </div>
        <footer class="tile__footer tile__footer--mini">
          Pouls <strong>{{ displayValue(displayHeartRate) }}</strong> b/min
        </footer>
      </section>

      <!-- PNI -->
      <section class="tile tile--bp" :class="{ 'tile--alert': sessionStore.outOfRange.systolic || sessionStore.outOfRange.diastolic }">
        <header class="tile__header"><span>PNI</span><span>mmHg</span></header>

        <div v-if="bpMeasuring" class="bp-overlay">
          <div class="cuff">PNI</div>
          <div class="progress"><div class="bar" :style="{ width: bpProgress + '%' }"></div></div>
          <p>Mesure en cours… {{ Math.round(bpProgress) }}%</p>
        </div>
        <div v-else-if="!bpMeasured" class="bp-overlay">
          <button class="btn" @click="startBpMeasurement">Démarrer PNI</button>
        </div>

        <div v-if="bpMeasured" class="bp-layout">
          <div class="bp-col"><span class="bp-label">SYS</span><strong>{{ displayValue(sessionStore.vitals?.systolic) }}</strong></div>
          <div class="bp-col"><span class="bp-label">DIA</span><strong>{{ displayValue(sessionStore.vitals?.diastolic) }}</strong></div>
          <div class="bp-col"><span class="bp-label">MAP</span><strong>{{ displayValue(sessionStore.meanArterialPressure) }}</strong></div>
        </div>
        <footer class="tile__footer tile__footer--scale">
          <div class="scale"><span>160</span><span>120</span><span>90</span><span>60</span><span>0</span></div>
          <button class="mini-btn" v-if="bpMeasured && !bpMeasuring" @click="restartBp">Reprendre</button>
        </footer>
      </section>

      <!-- Temp placeholder -->
      <section class="tile tile--temp">
        <header class="tile__header"><span>Temp</span><span>°C</span></header>
        <div class="tile__value tile__value--md"><span>37.2</span></div>
        <footer class="tile__footer tile__footer--mini">Mode démo</footer>
      </section>
    </main>

    <footer class="monitor-bottom">
      <span>DEFIGARD</span>
      <button class="mini-btn" @click="toggleBeep">Bip: {{ beepOn ? 'ON' : 'OFF' }}</button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const sessionStore = useSessionStore()

const now = ref('')
let clockTimer

// Jitter (oscillation légère)
const displayHeartRate = ref(null)
const displaySpo2 = ref(null)
let jitterTimer

// Bip sonore
const beepOn = ref(false)
let audioCtx
let beepTimeout

// Mesure PNI
const bpMeasuring = ref(false)
const bpMeasured = ref(false)
const bpProgress = ref(0)

const formattedExpiry = computed(() =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(sessionStore.session.expiresAt))
)

function updateClock () {
  now.value = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date())
}

const displayValue = (v) => (v === null || v === undefined ? '--' : v)

onMounted(() => {
  updateClock(); clockTimer = setInterval(updateClock, 30_000)
  startJitter()
  // Activer le bip dès l'initialisation (avec reprise AudioContext si nécessaire)
  try {
    beepOn.value = true
    ensureAudio()
    if (audioCtx && audioCtx.state === 'suspended') { audioCtx.resume() }
    playBeep(); scheduleBeep()
  } catch {}
  const resume = async () => {
    try { if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume(); playBeep() } catch {}
    window.removeEventListener('pointerdown', resume)
    window.removeEventListener('keydown', resume)
  }
  window.addEventListener('pointerdown', resume, { once: true })
  window.addEventListener('keydown', resume, { once: true })
})

onUnmounted(() => {
  clearInterval(clockTimer)
  stopJitter(); stopBeep()
})

watch(() => sessionStore.expired, (v) => { if (v) router.push({ name: 'ended' }) })

watch(() => sessionStore.vitals, (v) => {
  if (!v) return
  displayHeartRate.value = v.heartRate ?? displayHeartRate.value
  displaySpo2.value = v.spo2 ?? displaySpo2.value
  if (beepOn.value) scheduleBeep()
}, { deep: true })

function startJitter () {
  const hrAmp = 2, spoAmp = 1
  const hrPeriod = 4000, spoPeriod = 6000
  const hrPhase = Math.random() * Math.PI * 2
  const spoPhase = Math.random() * Math.PI * 2
  jitterTimer = setInterval(() => {
    const v = sessionStore.vitals || {}
    const t = Date.now()
    const hr = v.heartRate ?? 60
    const spo = v.spo2 ?? 98
    displayHeartRate.value = Math.round(hr + hrAmp * Math.sin(((t + hrPhase) / hrPeriod) * 2 * Math.PI))
    displaySpo2.value = Math.round(spo + spoAmp * Math.sin(((t + spoPhase) / spoPeriod) * 2 * Math.PI))
  }, 400)
}
function stopJitter () { if (jitterTimer) clearInterval(jitterTimer) }

function ensureAudio () {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioCtx = new Ctx()
  }
}
function playBeep () {
  try {
    ensureAudio()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'sine'; osc.frequency.value = 880
    gain.gain.value = 0.0001
    osc.connect(gain).connect(audioCtx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12)
    osc.stop(audioCtx.currentTime + 0.13)
  } catch {}
}
function scheduleBeep () {
  if (!beepOn.value) return
  if (beepTimeout) clearTimeout(beepTimeout)
  const hr = displayHeartRate.value || sessionStore.vitals?.heartRate || 60
  const interval = Math.max(300, Math.min(2000, Math.round(60000 / hr)))
  beepTimeout = setTimeout(() => { playBeep(); scheduleBeep() }, interval)
}
function stopBeep () { if (beepTimeout) clearTimeout(beepTimeout) }
async function toggleBeep () {
  beepOn.value = !beepOn.value
  if (beepOn.value) {
    ensureAudio()
    try { if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume() } catch {}
    playBeep()
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
  const start = Date.now(); const total = 10_000
  const id = setInterval(() => {
    const elapsed = Date.now() - start
    bpProgress.value = Math.min(100, (elapsed / total) * 100)
    if (elapsed >= total) { clearInterval(id); bpMeasuring.value = false; bpMeasured.value = true; bpProgress.value = 100 }
  }, 100)
}
function restartBp () { startBpMeasurement() }
</script>

<style scoped>
.monitor-shell { width: 1400px; max-width: 98vw; min-height: min(820px,92vh); background: linear-gradient(145deg,#1a1f2d 0%,#0d111b 100%); border-radius: 32px; border: 5px solid #2d384f; padding: 2rem 2.2rem; display: grid; gap: 1.1rem; box-shadow: inset 0 0 40px rgba(8,10,20,.65), 0 45px 120px rgba(5,7,12,.7) }
.monitor-top { display:flex; justify-content:space-between; align-items:center; background: linear-gradient(180deg,#0b0d12,#151b25); border-radius:18px; padding:.7rem 1.1rem; border:1px solid rgba(148,163,184,.12); color: rgba(226,232,240,.75); font-size:.95rem }
.brand { display:flex; align-items:baseline; gap:.7rem }
.brand__name { font-weight:700; letter-spacing:.22em; color:#f97316 }
.brand__model { font-weight:500; color: rgba(148,163,184,.7) }
.toolbar { display:inline-flex; align-items:center; gap:.75rem }
.toolbar__clock { font-family: monospace; letter-spacing:.1em }
.toolbar__link { padding:.15rem .6rem; border-radius:999px; border:1px solid; font-size:.82rem; letter-spacing:.08em; text-transform:uppercase }
.link--ok { color:#34d399; border-color: rgba(52,211,153,.55) }
.link--down { color:#f87171; border-color: rgba(248,113,113,.55) }
.monitor-meta { display:flex; gap:1.2rem; flex-wrap:wrap; background: rgba(11,16,28,.9); border-radius:16px; padding:.7rem 1rem; border:1px solid rgba(107,114,128,.25); font-size:.95rem }
.meta-item { display:flex; gap:.45rem; align-items:center }
.meta-label { text-transform:uppercase; font-size:.75rem; letter-spacing:.1em; color: rgba(148,163,184,.7) }
.monitor-grid { display:grid; grid-template-columns: 1.55fr 1fr; grid-template-rows: 1.5fr 1.1fr; gap:1.1rem }
.tile { position:relative; background: radial-gradient(circle at top left, rgba(32,43,74,.95), #111725); border-radius:18px; border:2px solid rgba(63,81,181,.18); padding:1.1rem 1.3rem; display:grid; gap:.8rem; color:#f8fafc; box-shadow: inset 0 0 18px rgba(5,8,14,.5) }
.tile--alert { border-color: rgba(248,113,113,.7); box-shadow: inset 0 0 25px rgba(127,29,29,.8), 0 0 30px rgba(248,113,113,.35) }
.tile__header { display:flex; justify-content:space-between; font-size:.85rem; letter-spacing:.12em; text-transform:uppercase; color: rgba(226,232,240,.7) }
.tile__value { display:flex; align-items:center; justify-content:center; gap:.6rem; font-weight:700; line-height:1 }
.tile__value--xl { font-size: clamp(4.5rem, 8vw, 6rem) }
.tile__value--lg { font-size: clamp(3.8rem, 7vw, 5.2rem) }
.tile__value--md { font-size: clamp(2.6rem, 4vw, 3.5rem) }
.tile__icon { font-size: clamp(2.5rem, 4vw, 3.5rem); opacity:.8 }
.tile__footer { font-size:.85rem; color: rgba(203,213,225,.85); display:flex; align-items:center; justify-content:space-between }
.tile__footer--mini { justify-content:center; gap:.45rem }
.tile__footer--wave { justify-content:flex-start; gap:.6rem }
.wave { width:70%; height:18px; border-radius:12px; background: linear-gradient(90deg, rgba(0,255,197,.35) 0%, rgba(94,234,212,.7) 50%, rgba(0,255,197,.35) 100%); position:relative; overflow:hidden }
.wave::after { content:""; position:absolute; inset:0; background-image: repeating-linear-gradient(90deg, transparent 0, transparent 12px, rgba(8,145,178,.4) 12px, rgba(8,145,178,.4) 24px); opacity:.8; animation: flow 2.6s linear infinite }
@keyframes flow { from{ transform: translateX(0) } to{ transform: translateX(-24px) } }
.tile--pulse { background: radial-gradient(circle at top, #4c46b7, #312672 70%) }
.tile--spo2 { background: radial-gradient(circle at top, #1d40b4, #142358 75%) }
.tile--bp { grid-row: span 2; background: radial-gradient(circle at top, #1f2a43, #0f1625 70%) }
.tile--temp { background: radial-gradient(circle at top, #162c5c, #0d1320 70%) }
.bp-layout { display:flex; justify-content:space-around; align-items:flex-start; gap:1rem }
.bp-layout.hidden { opacity:.25; filter: blur(1px) }
.bp-col { text-align:center }
.bp-label { display:block; font-size:.75rem; letter-spacing:.12em; color: rgba(148,163,184,.7); margin-bottom:.3rem }
.bp-col strong { font-size: clamp(2.7rem, 5vw, 3.5rem); font-weight:600 }
.bp-overlay { position:absolute; inset:0; display:grid; place-items:center; gap:.6rem; background: rgba(0,0,0,.35); border-radius:16px; z-index:10 }
.bp-overlay .progress { width:70%; height:10px; background: rgba(255,255,255,.15); border-radius:999px; overflow:hidden }
.bp-overlay .progress .bar { height:100%; background:#38bdf8 }
.btn, .mini-btn { border:1px solid rgba(148,163,184,.5); background: rgba(15,23,42,.7); color:#e2e8f0; padding:.5rem 1rem; border-radius:10px; cursor:pointer }
.monitor-bottom { margin-top:.2rem; display:flex; justify-content:center; gap:1rem; font-size:1.05rem; letter-spacing:.2em; color: rgba(226,232,240,.6) }
@media (max-width: 1080px) { .monitor-grid{ grid-template-columns:1fr; grid-template-rows:repeat(4,minmax(220px,auto)) } .tile--bp{ grid-row:auto } }
</style>
