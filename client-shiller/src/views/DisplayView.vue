<template>
  <div class="monitor-shell">
    <header class="monitor-top">
      <div class="brand">
        <span class="brand__name">SCHILLER</span>
        <span class="brand__model">Touch 7</span>
      </div>
      <div class="toolbar">
        <span class="toolbar__clock">{{ now }}</span>
        <span class="toolbar__icon">☀️</span>
        <span class="toolbar__icon">📶</span>
        <span class="toolbar__icon">👤</span>
        <span class="toolbar__icon">🔔</span>
        <span
          class="toolbar__link"
          :class="sessionStore.socketConnected ? 'link--ok' : 'link--down'"
        >
          {{ sessionStore.socketConnected ? "Lien OK" : "Lien perdu" }}
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
      <section
        class="tile tile--pulse"
        :class="{ 'tile--alert': sessionStore.outOfRange.heartRate }"
      >
        <header class="tile__header">
          <span>Pouls</span>
          <span>b/min</span>
        </header>
        <div class="tile__value tile__value--xl">
          <span>{{ displayValue(sessionStore.vitals?.heartRate) }}</span>
          <span class="tile__icon">❤</span>
        </div>
        <footer class="tile__footer tile__footer--wave">
          <span>Rythm.</span>
          <span class="wave"></span>
        </footer>
      </section>

      <section
        class="tile tile--spo2"
        :class="{ 'tile--alert': sessionStore.outOfRange.spo2 }"
      >
        <header class="tile__header">
          <span>SpO₂</span>
          <span>%</span>
        </header>
        <div class="tile__value tile__value--lg">
          <span>{{ displayValue(sessionStore.vitals?.spo2) }}</span>
        </div>
        <footer class="tile__footer tile__footer--mini">
          Pouls
          <strong>{{ displayValue(sessionStore.vitals?.heartRate) }}</strong>
          b/min
        </footer>
      </section>

      <section
        class="tile tile--bp"
        :class="{
          'tile--alert':
            sessionStore.outOfRange.systolic ||
            sessionStore.outOfRange.diastolic,
        }"
      >
        <header class="tile__header">
          <span>PNI</span>
          <span>mmHg</span>
        </header>
        <div class="bp-layout">
          <div class="bp-col">
            <span class="bp-label">SYS</span>
            <strong>{{ displayValue(sessionStore.vitals?.systolic) }}</strong>
          </div>
          <div class="bp-col">
            <span class="bp-label">DIA</span>
            <strong>{{ displayValue(sessionStore.vitals?.diastolic) }}</strong>
          </div>
          <div class="bp-col">
            <span class="bp-label">MAP</span>
            <strong>{{ displayValue(sessionStore.meanArterialPressure) }}</strong>
          </div>
        </div>
        <footer class="tile__footer tile__footer--scale">
          <div class="scale">
            <span>160</span>
            <span>120</span>
            <span>90</span>
            <span>60</span>
            <span>0</span>
          </div>
        </footer>
      </section>

      <section class="tile tile--temp">
        <header class="tile__header">
          <span>Temp</span>
          <span>°C</span>
        </header>
        <div class="tile__value tile__value--md">
          <span>37.2</span>
        </div>
        <footer class="tile__footer tile__footer--mini">
          Mode démo
        </footer>
      </section>
    </main>

    <footer class="monitor-bottom">
      <span>DEFIGARD</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "../stores/session";

const router = useRouter();
const sessionStore = useSessionStore();
const now = ref("");
let timer;

const formattedExpiry = computed(() =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(sessionStore.session.expiresAt)),
);

const updateClock = () => {
  now.value = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
};

const displayValue = (value) => (value === null || value === undefined ? "--" : value);

onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 30 * 1000);
});

onUnmounted(() => {
  clearInterval(timer);
});

watch(
  () => sessionStore.expired,
  (value) => {
    if (value) {
      router.push({ name: "ended" });
    }
  },
);
</script>

<style scoped>
.monitor-shell {
  width: min(1150px, 96vw);
  background: linear-gradient(145deg, #1a1f2d 0%, #0d111b 100%);
  border-radius: 32px;
  border: 5px solid #2d384f;
  padding: 1.4rem 1.6rem;
  display: grid;
  gap: 0.9rem;
  box-shadow: inset 0 0 40px rgba(8, 10, 20, 0.65), 0 45px 120px rgba(5, 7, 12, 0.7);
}

.monitor-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(180deg, #0b0d12, #151b25);
  border-radius: 18px;
  padding: 0.7rem 1.1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  color: rgba(226, 232, 240, 0.75);
  font-size: 0.95rem;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
}

.brand__name {
  font-weight: 700;
  letter-spacing: 0.22em;
  color: #f97316;
}

.brand__model {
  font-weight: 500;
  color: rgba(148, 163, 184, 0.7);
}

.toolbar {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.toolbar__clock {
  font-family: "Roboto Mono", monospace;
  letter-spacing: 0.1em;
}

.toolbar__icon {
  font-size: 1.05rem;
  opacity: 0.85;
}

.toolbar__link {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  border: 1px solid;
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.link--ok {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.55);
}

.link--down {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.55);
}

.monitor-meta {
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  background: rgba(11, 16, 28, 0.9);
  border-radius: 16px;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(107, 114, 128, 0.25);
  font-size: 0.95rem;
}

.meta-item {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.meta-label {
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: rgba(148, 163, 184, 0.7);
}

.monitor-grid {
  display: grid;
  grid-template-columns: 1.4fr 0.9fr;
  grid-template-rows: 1.4fr 1fr;
  gap: 0.8rem;
}

.tile {
  position: relative;
  background: radial-gradient(circle at top left, rgba(32, 43, 74, 0.95), #111725);
  border-radius: 18px;
  border: 2px solid rgba(63, 81, 181, 0.18);
  padding: 1.1rem 1.3rem;
  display: grid;
  gap: 0.8rem;
  color: #f8fafc;
  box-shadow: inset 0 0 18px rgba(5, 8, 14, 0.5);
}

.tile--alert {
  border-color: rgba(248, 113, 113, 0.7);
  box-shadow:
    inset 0 0 25px rgba(127, 29, 29, 0.8),
    0 0 30px rgba(248, 113, 113, 0.35);
}

.tile__header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.7);
}

.tile__value {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  font-weight: 700;
  line-height: 1;
}

.tile__value--xl {
  font-size: clamp(4.5rem, 8vw, 6rem);
}

.tile__value--lg {
  font-size: clamp(3.8rem, 7vw, 5.2rem);
}

.tile__value--md {
  font-size: clamp(2.6rem, 4vw, 3.5rem);
}

.tile__icon {
  font-size: clamp(2.5rem, 4vw, 3.5rem);
  opacity: 0.8;
}

.tile__footer {
  font-size: 0.85rem;
  color: rgba(203, 213, 225, 0.85);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tile__footer--mini {
  justify-content: center;
  gap: 0.45rem;
}

.tile__footer--wave {
  justify-content: flex-start;
  gap: 0.6rem;
}

.wave {
  width: 70%;
  height: 18px;
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    rgba(0, 255, 197, 0.35) 0%,
    rgba(94, 234, 212, 0.7) 50%,
    rgba(0, 255, 197, 0.35) 100%
  );
  position: relative;
  overflow: hidden;
}

.wave::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent 12px,
    rgba(8, 145, 178, 0.4) 12px,
    rgba(8, 145, 178, 0.4) 24px
  );
  opacity: 0.8;
  animation: flow 2.6s linear infinite;
}

@keyframes flow {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-24px);
  }
}

.tile--pulse {
  background: radial-gradient(circle at top, #4c46b7, #312672 70%);
  color: #f8f9ff;
}

.tile--spo2 {
  background: radial-gradient(circle at top, #1d40b4, #142358 75%);
}

.tile--bp {
  grid-row: span 2;
  background: radial-gradient(circle at top, #1f2a43, #0f1625 70%);
}

.tile--temp {
  background: radial-gradient(circle at top, #162c5c, #0d1320 70%);
}

.bp-layout {
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  gap: 1rem;
}

.bp-col {
  text-align: center;
}

.bp-label {
  display: block;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.7);
  margin-bottom: 0.3rem;
}

.bp-col strong {
  font-size: clamp(2.7rem, 5vw, 3.5rem);
  font-weight: 600;
}

.tile__footer--scale .scale {
  width: 100%;
  display: flex;
  justify-content: space-between;
  font-family: "Roboto Mono", monospace;
  font-size: 0.8rem;
  color: rgba(148, 163, 184, 0.65);
}

.monitor-bottom {
  margin-top: 0.2rem;
  display: flex;
  justify-content: center;
  font-size: 1.05rem;
  letter-spacing: 0.2em;
  color: rgba(226, 232, 240, 0.6);
}

@media (max-width: 1000px) {
  .monitor-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, auto);
  }

  .tile--bp {
    grid-row: auto;
  }
}
</style>
