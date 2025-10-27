import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useAuthStore } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const useSessionsStore = defineStore("sessions", () => {
  const authStore = useAuthStore();
  const sessions = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const upcomingSessions = computed(() =>
    sessions.value.filter((session) => !session.closedAt),
  );

  const pastSessions = computed(() =>
    sessions.value.filter((session) => session.closedAt),
  );

  const fetchSessions = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        headers: {
          "Content-Type": "application/json",
          ...authStore.authHeader,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible de récupérer les sessions");
      }
      const payload = await response.json();
      sessions.value = payload.sessions ?? [];
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const createSession = async (traineeName) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authStore.authHeader,
        },
        body: JSON.stringify({ traineeName }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "La session n'a pas pu être créée");
      }
      const payload = await response.json();
      sessions.value = [payload.session, ...sessions.value];
      return payload.session;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const closeSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authStore.authHeader,
        },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Impossible de clôturer la session");
      }
      sessions.value = sessions.value.map((session) =>
        session.id === sessionId
          ? { ...session, closedAt: new Date().toISOString() }
          : session,
      );
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  const clear = () => {
    sessions.value = [];
    loading.value = false;
    error.value = null;
  };

  const updateSessionValues = (sessionId, values, timestamp) => {
    sessions.value = sessions.value.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            lastValues: { ...values },
            updatedAt: timestamp,
          }
        : session,
    );
  };

  const markSessionClosed = (sessionId, reason = "closed") => {
    sessions.value = sessions.value.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            closedAt: new Date().toISOString(),
            closedReason: reason,
          }
        : session,
    );
  };

  return {
    sessions,
    loading,
    error,
    upcomingSessions,
    pastSessions,
    fetchSessions,
    createSession,
    closeSession,
    clear,
    updateSessionValues,
    markSessionClosed,
    async updateTraineeName(sessionId, traineeName) {
      try {
        const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authStore.authHeader,
          },
          body: JSON.stringify({ traineeName }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Impossible de mettre à jour le prénom");
        }
        const { session } = await response.json();
        sessions.value = sessions.value.map((item) =>
          item.id === sessionId ? { ...item, traineeName: session.traineeName } : item,
        );
        return session;
      } catch (err) {
        error.value = err.message;
        throw err;
      }
    },
  };
});
