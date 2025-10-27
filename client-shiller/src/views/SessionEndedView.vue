<template>
  <main class="ended-screen">
    <section class="panel">
      <h1>Session terminée</h1>
      <p>Le formateur a clôturé ou expiré la session.</p>
      <RouterLink class="button" to="/">Revenir à l’accueil</RouterLink>
    </section>
  </main>
</template>

<style scoped>
.ended-screen {
  width: min(480px, 100%);
}

.panel {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(248, 113, 113, 0.5);
  border-radius: 22px;
  padding: 2.5rem;
  text-align: center;
  box-shadow: 0 40px 70px rgba(8, 10, 20, 0.6);
  display: grid;
  gap: 1.2rem;
}

h1 {
  margin: 0;
  color: #f87171;
  letter-spacing: 0.1em;
  font-size: 1.6rem;
}

p {
  margin: 0;
  color: rgba(226, 232, 240, 0.85);
}

.button {
  margin: 0 auto;
  padding: 0.7rem 1.3rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  color: #f8fafc;
  text-decoration: none;
  letter-spacing: 0.08em;
}

.button:hover {
  background: rgba(148, 163, 184, 0.15);
}
</style>
