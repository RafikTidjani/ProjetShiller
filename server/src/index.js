import http from "http";
import { randomUUID, randomBytes } from "crypto";
import express from "express";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";

const PORT = process.env.PORT || 4000;
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 heure
const TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 heure
const DEMO_TRAINERS = [
  {
    id: "trainer-1",
    email: "formateur@demo.fr",
    password: "demo123", // à remplacer plus tard par une version hashée
  },
];

const activeTokens = new Map(); // token -> { trainerId, expiresAt }
const sessions = new Map(); // sessionId -> session
const sessionsByCode = new Map(); // code -> sessionId
const valueEvents = new Map(); // sessionId -> [{...}]

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

// --- Utils ------------------------------------------------------------------

const generateSessionCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres

const authenticate = (email, password) =>
  DEMO_TRAINERS.find(
    (trainer) =>
      trainer.email.toLowerCase() === email.toLowerCase() &&
      trainer.password === password,
  );

const issueToken = (trainerId) => {
  const token = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + TOKEN_DURATION_MS;
  activeTokens.set(token, { trainerId, expiresAt });
  return { token, expiresAt };
};

const validateToken = (authorizationHeader) => {
  if (!authorizationHeader) return null;
  const [, token] = authorizationHeader.split(" ");
  if (!token) return null;
  const payload = activeTokens.get(token);
  if (!payload) return null;
  if (payload.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return { token, ...payload };
};

const requireAuth = (req, res, next) => {
  const auth = validateToken(req.headers.authorization);
  if (!auth) {
    return res.status(401).json({ error: "Authentification requise" });
  }
  req.trainerId = auth.trainerId;
  req.token = auth.token;
  return next();
};

const getSessionById = (sessionId) => sessions.get(sessionId);

const markSessionClosed = (sessionId, reason = "closed") => {
  const session = sessions.get(sessionId);
  if (!session || session.closedAt) return;
  session.closedAt = new Date().toISOString();
  sessions.set(sessionId, session);
  sessionsByCode.delete(session.code);
  io.to(sessionId).emit("session-expired", { reason, sessionId });
};

const pruneExpiredSessions = () => {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (!session.closedAt && new Date(session.expiresAt).getTime() <= now) {
      markSessionClosed(session.id, "expired");
    }
  }
};

// lancer le job de nettoyage toutes les minutes
setInterval(pruneExpiredSessions, 60 * 1000);

// --- Routes -----------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }
  const trainer = authenticate(email, password);
  if (!trainer) {
    return res
      .status(401)
      .json({ error: "Identifiants invalides (demo : formateur@demo.fr / demo123)" });
  }
  const { token, expiresAt } = issueToken(trainer.id);
  return res.json({
    token,
    expiresAt,
    trainer: { id: trainer.id, email: trainer.email },
  });
});

app.get("/api/sessions", requireAuth, (req, res) => {
  const activeSessions = [...sessions.values()]
    .filter((session) => session.trainerId === req.trainerId)
    .map((session) => ({
      ...session,
      eventsCount: valueEvents.get(session.id)?.length || 0,
    }));
  res.json({ sessions: activeSessions });
});

app.post("/api/sessions", requireAuth, (req, res) => {
  const { traineeName = "" } = req.body || {};
  const sessionId = randomUUID();
  let code = generateSessionCode();
  while (sessionsByCode.has(code)) {
    code = generateSessionCode();
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);
  const session = {
    id: sessionId,
    trainerId: req.trainerId,
    code,
    traineeName: traineeName?.toString().trim().slice(0, 80) || null,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    closedAt: null,
    lastValues: {
      systolic: 120,
      diastolic: 80,
      heartRate: 70,
      spo2: 98,
    },
  };

  sessions.set(sessionId, session);
  sessionsByCode.set(code, sessionId);
  valueEvents.set(sessionId, [
    { ...session.lastValues, timestamp: createdAt.toISOString() },
  ]);

  res.status(201).json({ session });
});

app.delete("/api/sessions/:id", requireAuth, (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session || session.trainerId !== req.trainerId) {
    return res.status(404).json({ error: "Session introuvable" });
  }
  markSessionClosed(session.id, "closed");
  res.status(204).send();
});

app.post("/api/sessions/:id/values", requireAuth, (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session || session.trainerId !== req.trainerId) {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (session.closedAt) {
    return res.status(409).json({ error: "Session déjà clôturée" });
  }

  const { systolic, diastolic, heartRate, spo2 } = req.body || {};
  if (
    [systolic, diastolic, heartRate, spo2].some(
      (value) => typeof value !== "number",
    )
  ) {
    return res
      .status(400)
      .json({ error: "Les valeurs doivent être de type numérique" });
  }

  const timestamp = new Date().toISOString();
  session.lastValues = { systolic, diastolic, heartRate, spo2 };
  sessions.set(session.id, session);

  const events = valueEvents.get(session.id) || [];
  events.push({ ...session.lastValues, timestamp });
  valueEvents.set(session.id, events);

  const outOfRangeFlags = {
    systolic: systolic < 40 || systolic > 260,
    diastolic: diastolic < 20 || diastolic > 180,
    heartRate: heartRate < 20 || heartRate > 220,
    spo2: spo2 < 40 || spo2 > 100,
  };

  io.to(session.id).emit("session-values", {
    sessionId: session.id,
    ...session.lastValues,
    timestamp,
    outOfRange: outOfRangeFlags,
  });

  res.json({ ok: true, updatedAt: timestamp });
});

app.patch("/api/sessions/:id", requireAuth, (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session || session.trainerId !== req.trainerId) {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (session.closedAt) {
    return res.status(409).json({ error: "Session déjà clôturée" });
  }

  const { traineeName } = req.body || {};
  const sanitizedName =
    typeof traineeName === "string"
      ? traineeName.trim().slice(0, 80) || null
      : session.traineeName ?? null;

  session.traineeName = sanitizedName;
  sessions.set(session.id, session);

  res.json({ session });
});

app.post("/api/public/session-join", (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: "Code de session requis" });
  }
  const sessionId = sessionsByCode.get(code);
  if (!sessionId) {
    return res.status(404).json({ error: "Session introuvable" });
  }
  const session = sessions.get(sessionId);
  if (!session || session.closedAt) {
    return res.status(404).json({ error: "Session expirée" });
  }
  return res.json({
    session: {
      id: session.id,
      code: session.code,
      expiresAt: session.expiresAt,
      lastValues: session.lastValues,
    },
  });
});

// --- Socket.IO --------------------------------------------------------------

io.on("connection", (socket) => {
  socket.on("join-session", ({ sessionCode }) => {
    const sessionId = sessionsByCode.get(sessionCode);
    const session = sessionId ? sessions.get(sessionId) : null;
    if (!session || session.closedAt) {
      socket.emit("session-expired", { reason: "not-found" });
      return;
    }
    socket.join(sessionId);
    socket.emit("session-values", {
      sessionId: session.id,
      ...session.lastValues,
      timestamp: new Date().toISOString(),
      outOfRange: {
        systolic:
          session.lastValues.systolic < 40 ||
          session.lastValues.systolic > 260,
        diastolic:
          session.lastValues.diastolic < 20 ||
          session.lastValues.diastolic > 180,
        heartRate:
          session.lastValues.heartRate < 20 ||
          session.lastValues.heartRate > 220,
        spo2:
          session.lastValues.spo2 < 40 || session.lastValues.spo2 > 100,
      },
    });
  });

  socket.on("disconnect", () => {
    // pas de traitement particulier pour l'instant
  });
});

server.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
