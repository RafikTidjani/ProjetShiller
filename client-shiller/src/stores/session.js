import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const useSessionStore = defineStore("session", () => {
  const session = ref(null);
  const vitals = ref(null);
  const socketConnected = ref(false);
  const outOfRange = ref({
    systolic: false,
    diastolic: false,
    heartRate: false,
    spo2: false,
  });
  const error = ref(null);
  const loading = ref(false);
  const expired = ref(false);

  let socket;

  const meanArterialPressure = computed(() => {
    if (!vitals.value) return null;
    return Math.round(
      (vitals.value.diastolic * 2 + vitals.value.systolic) / 3,
    );
  });

  const reset = () => {
    session.value = null;
    vitals.value = null;
    outOfRange.value = {
      systolic: false,
      diastolic: false,
      heartRate: false,
      spo2: false,
    };
    error.value = null;
    disconnectSocket();
    expired.value = false;
    socketConnected.value = false;
  };

  const joinSession = async (code) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE}/api/public/session-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Session introuvable");
      }
      const payload = await response.json();
      session.value = payload.session;
      vitals.value = payload.session.lastValues;
      outOfRange.value = {
        systolic:
          payload.session.lastValues?.systolic < 40 ||
          payload.session.lastValues?.systolic > 260,
        diastolic:
          payload.session.lastValues?.diastolic < 20 ||
          payload.session.lastValues?.diastolic > 180,
        heartRate:
          payload.session.lastValues?.heartRate < 20 ||
          payload.session.lastValues?.heartRate > 220,
        spo2:
          payload.session.lastValues?.spo2 < 40 ||
          payload.session.lastValues?.spo2 > 100,
      };
      connectSocket(payload.session.code);
      return payload.session;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const connectSocket = (code) => {
    disconnectSocket();
    socket = io(API_BASE, { transports: ["websocket"] });
    socket.on("connect", () => {
      socketConnected.value = true;
      socket.emit("join-session", { sessionCode: code });
    });
    socket.on("disconnect", () => {
      socketConnected.value = false;
    });
    socket.on("session-values", (payload) => {
      if (!session.value || payload.sessionId !== session.value.id) return;
      vitals.value = {
        systolic: payload.systolic,
        diastolic: payload.diastolic,
        heartRate: payload.heartRate,
        spo2: payload.spo2,
        sensorsOn:
          payload.sensorsOn ??
          vitals.value?.sensorsOn ??
          true,
      };
      outOfRange.value = payload.outOfRange ?? outOfRange.value;
    });
    socket.on("session-expired", () => {
      expired.value = true;
      disconnectSocket();
    });
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    socketConnected.value = false;
  };

  return {
    session,
    vitals,
    outOfRange,
    error,
    loading,
    socketConnected,
    expired,
    meanArterialPressure,
    joinSession,
    reset,
  };
});
