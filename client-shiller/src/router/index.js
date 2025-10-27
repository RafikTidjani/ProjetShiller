import { createRouter, createWebHistory } from "vue-router";
import { useSessionStore } from "../stores/session";

const JoinView = () => import("../views/JoinView.vue");
const DisplayView = () => import("../views/DisplayView.vue");
const SessionEndedView = () => import("../views/SessionEndedView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "join", component: JoinView },
    { path: "/session/:sessionId", name: "display", component: DisplayView },
    { path: "/session-ended", name: "ended", component: SessionEndedView },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to) => {
  const sessionStore = useSessionStore();
  if (to.name === "display" && !sessionStore.session) {
    return { name: "join" };
  }
  if (to.name === "join" && sessionStore.session) {
    return { name: "display", params: { sessionId: sessionStore.session.id } };
  }
  return true;
});

export default router;
