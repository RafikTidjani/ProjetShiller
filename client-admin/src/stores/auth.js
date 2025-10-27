import { defineStore } from "pinia";
import router from "../router";

const STORAGE_KEY = "shiller-trainer-admin";

const loadPersisted = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const persist = (payload) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: null,
    trainer: null,
    expiresAt: null,
    loading: false,
    error: null,
  }),
  getters: {
    isAuthenticated(state) {
      if (!state.token || !state.expiresAt) return false;
      return new Date(state.expiresAt).getTime() > Date.now();
    },
    authHeader(state) {
      return state.token ? { Authorization: `Bearer ${state.token}` } : {};
    },
  },
  actions: {
    hydrate() {
      const persisted = loadPersisted();
      if (!persisted) return;
      this.token = persisted.token;
      this.trainer = persisted.trainer;
      this.expiresAt = persisted.expiresAt;
    },
    async login(email, password) {
      this.loading = true;
      this.error = null;
      try {
        const response = await fetch("http://localhost:4000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error || "Identifiants invalides");
        }
        const payload = await response.json();
        this.token = payload.token;
        this.expiresAt = new Date(payload.expiresAt).toISOString();
        this.trainer = payload.trainer;
        persist({
          token: this.token,
          expiresAt: this.expiresAt,
          trainer: this.trainer,
        });
        router.push({ name: "dashboard" });
      } catch (err) {
        this.error = err.message;
        this.token = null;
        this.trainer = null;
        this.expiresAt = null;
      } finally {
        this.loading = false;
      }
    },
    logout() {
      this.token = null;
      this.trainer = null;
      this.expiresAt = null;
      this.error = null;
      localStorage.removeItem(STORAGE_KEY);
      router.push({ name: "login" });
    },
  },
});
