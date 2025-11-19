import http from "http";
import { randomBytes } from "crypto";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { Server as SocketIOServer } from "socket.io";
import { ensureDemoTrainer, findTrainerByEmail } from "./repositories/trainers.js";
import {
  createSession,
  listSessionsByTrainer,
  updateSessionValues,
  updateSessionTraineeName,
  closeSession,
  findActiveSessionByCode,
  expireSessions,
  updateSensorsFlag,
} from "./repositories/sessions.js";

const PORT = process.env.PORT || 4000;
const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 heure
const TOKEN_DURATION_MS = 60 * 60 * 1000; // 1 heure

const activeTokens = new Map(); // token -> { trainerId, expiresAt }

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

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

const computeOutOfRange = ({ systolic, diastolic, heartRate, spo2 }) => ({
  systolic: systolic < 40 || systolic > 260,
  diastolic: diastolic < 20 || diastolic > 180,
  heartRate: heartRate < 20 || heartRate > 220,
  spo2: spo2 < 40 || spo2 > 100,
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }
  const trainer = await findTrainerByEmail(email);
  if (!trainer) {
    return res
      .status(401)
      .json({ error: "Identifiants invalides (demo : formateur@demo.fr / demo123)" });
  }
  const passwordValid = await bcrypt.compare(password, trainer.passwordHash);
  if (!passwordValid) {
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

app.get("/api/sessions", requireAuth, async (req, res) => {
  const sessions = await listSessionsByTrainer(req.trainerId);
  res.json({ sessions });
});

app.post("/api/sessions", requireAuth, async (req, res, next) => {
  try {
    const { traineeName } = req.body || {};
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
    const defaultValues = {
      systolic: 120,
      diastolic: 80,
      heartRate: 70,
      spo2: 98,
    };
    const session = await createSession({
      trainerId: req.trainerId,
      traineeName,
      expiresAt,
      defaultValues,
    });
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/sessions/:id", requireAuth, async (req, res) => {
  const result = await closeSession({
    sessionId: req.params.id,
    trainerId: req.trainerId,
  });
  if (result.status === "not-found") {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (result.status === "forbidden") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  io.to(req.params.id).emit("session-expired", {
    reason: "closed",
    sessionId: req.params.id,
  });
  return res.status(204).send();
});

app.post("/api/sessions/:id/values", requireAuth, async (req, res) => {
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
  const values = { systolic, diastolic, heartRate, spo2 };
  const flags = computeOutOfRange(values);
  const result = await updateSessionValues({
    sessionId: req.params.id,
    trainerId: req.trainerId,
    values,
    flags,
  });
  if (result.status === "not-found") {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (result.status === "forbidden") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  if (result.status === "closed") {
    return res.status(409).json({ error: "Session déjà clôturée" });
  }
  io.to(req.params.id).emit("session-values", {
    sessionId: req.params.id,
    ...values,
    timestamp: result.timestamp,
    outOfRange: flags,
  });
  res.json({ ok: true, updatedAt: result.timestamp });
});

app.patch("/api/sessions/:id", requireAuth, async (req, res) => {
  const { traineeName } = req.body || {};
  const result = await updateSessionTraineeName({
    sessionId: req.params.id,
    trainerId: req.trainerId,
    traineeName,
  });
  if (result.status === "not-found") {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (result.status === "forbidden") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  if (result.status === "closed") {
    return res.status(409).json({ error: "Session déjà clôturée" });
  }
  res.json({ session: result.session });
});

app.post("/api/public/session-join", async (req, res) => {
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: "Code de session requis" });
  }
  const session = await findActiveSessionByCode(code);
  if (!session) {
    return res.status(404).json({ error: "Session introuvable" });
  }
  return res.json({
    session: {
      id: session.id,
      code: session.code,
      expiresAt: session.expiresAt,
      traineeName: session.traineeName,
      lastValues: session.lastValues,
    },
  });
});

app.post("/api/sessions/:id/sensors", requireAuth, async (req, res) => {
  const { sensorsOn } = req.body || {};
  const result = await updateSensorsFlag({
    sessionId: req.params.id,
    trainerId: req.trainerId,
    sensorsOn: !!sensorsOn,
  });
  if (result.status === "not-found") {
    return res.status(404).json({ error: "Session introuvable" });
  }
  if (result.status === "forbidden") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  if (result.status === "closed") {
    return res.status(409).json({ error: "Session déjà clôturée" });
  }
  const v = result.session.lastValues || {};
  io.to(req.params.id).emit("session-values", {
    sessionId: req.params.id,
    ...v,
    timestamp: new Date().toISOString(),
    outOfRange: computeOutOfRange({
      systolic: v.systolic ?? 0,
      diastolic: v.diastolic ?? 0,
      heartRate: v.heartRate ?? 0,
      spo2: v.spo2 ?? 0,
    }),
  });
  res.json({ session: result.session });
});

io.on("connection", (socket) => {
  socket.on("join-session", async ({ sessionCode }) => {
    const session = await findActiveSessionByCode(sessionCode);
    if (!session) {
      socket.emit("session-expired", { reason: "not-found" });
      return;
    }
    socket.join(session.id);
    socket.emit("session-values", {
      sessionId: session.id,
      ...session.lastValues,
      timestamp: new Date().toISOString(),
      outOfRange: computeOutOfRange(session.lastValues),
    });
  });
});

const scheduleExpirationJob = () => {
  setInterval(async () => {
    try {
      const expired = await expireSessions();
      expired.forEach((session) => {
        io.to(session.id).emit("session-expired", {
          reason: "expired",
          sessionId: session.id,
        });
      });
    } catch (error) {
      console.error("[expireSessions] failure", error);
    }
  }, 60 * 1000);
};

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur" });
});

const start = async () => {
  await ensureDemoTrainer();
  scheduleExpirationJob();
  server.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
