import { pool, withTransaction } from "../db/pool.js";

const generateSessionCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const mapSessionRow = (row, eventsCount = 0) => ({
  id: row.id,
  trainerId: row.trainer_id,
  code: row.code,
  traineeName: row.trainee_name,
  createdAt: row.created_at?.toISOString
    ? row.created_at.toISOString()
    : row.created_at,
  expiresAt: row.expires_at?.toISOString
    ? row.expires_at.toISOString()
    : row.expires_at,
  closedAt: row.closed_at?.toISOString
    ? row.closed_at.toISOString()
    : row.closed_at,
  lastValues: row.last_values ?? {},
  eventsCount,
});

export const listSessionsByTrainer = async (trainerId) => {
  const { rows } = await pool.query(
    `SELECT s.*, COALESCE(e.events_count, 0) AS events_count
     FROM sessions s
     LEFT JOIN (
       SELECT session_id, COUNT(*) AS events_count
       FROM session_events
       GROUP BY session_id
     ) e ON e.session_id = s.id
     WHERE s.trainer_id = $1
     ORDER BY s.created_at DESC`,
    [trainerId],
  );
  return rows.map((row) => mapSessionRow(row, Number(row.events_count ?? 0)));
};

export const createSession = async ({
  trainerId,
  traineeName,
  expiresAt,
  defaultValues,
}) => {
  const sanitizedName =
    typeof traineeName === "string"
      ? traineeName.trim().slice(0, 80) || null
      : null;
  const flags = {
    systolic: false,
    diastolic: false,
    heartRate: false,
    spo2: false,
  };

  return withTransaction(async (client) => {
    let attempt = 0;
    const maxAttempts = 5;
    // eslint-disable-next-line no-constant-condition
    while (attempt < maxAttempts) {
      attempt += 1;
      const code = generateSessionCode();
      try {
        const { rows } = await client.query(
          `INSERT INTO sessions (trainer_id, code, trainee_name, expires_at, last_values)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [trainerId, code, sanitizedName, expiresAt, defaultValues],
        );
        const sessionRow = rows[0];
        await client.query(
          `INSERT INTO session_events (session_id, systolic, diastolic, heart_rate, spo2, flags)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sessionRow.id,
            defaultValues.systolic,
            defaultValues.diastolic,
            defaultValues.heartRate,
            defaultValues.spo2,
            flags,
          ],
        );
        return mapSessionRow(sessionRow, 1);
      } catch (error) {
        if (error.code === "23505") {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Impossible de générer un code unique");
  });
};

export const findSessionById = async (sessionId) => {
  const { rows } = await pool.query("SELECT * FROM sessions WHERE id = $1", [
    sessionId,
  ]);
  return rows[0] ? mapSessionRow(rows[0]) : null;
};

export const updateSessionValues = async ({
  sessionId,
  trainerId,
  values,
  flags,
}) =>
  withTransaction(async (client) => {
    const {
      rows: [sessionRow],
    } = await client.query(
      "SELECT * FROM sessions WHERE id = $1 FOR UPDATE",
      [sessionId],
    );
    if (!sessionRow) {
      return { status: "not-found" };
    }
    if (sessionRow.trainer_id !== trainerId) {
      return { status: "forbidden" };
    }
    if (sessionRow.closed_at) {
      return { status: "closed" };
    }
    const timestamp = new Date().toISOString();
    await client.query("UPDATE sessions SET last_values = $1 WHERE id = $2", [
      values,
      sessionId,
    ]);
    await client.query(
      `INSERT INTO session_events (session_id, systolic, diastolic, heart_rate, spo2, flags, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        sessionId,
        values.systolic,
        values.diastolic,
        values.heartRate,
        values.spo2,
        flags,
        timestamp,
      ],
    );
    sessionRow.last_values = values;
    return {
      status: "ok",
      session: mapSessionRow(sessionRow),
      timestamp,
    };
  });

export const updateSessionTraineeName = async ({
  sessionId,
  trainerId,
  traineeName,
}) =>
  withTransaction(async (client) => {
    const {
      rows: [sessionRow],
    } = await client.query(
      "SELECT * FROM sessions WHERE id = $1 FOR UPDATE",
      [sessionId],
    );
    if (!sessionRow) {
      return { status: "not-found" };
    }
    if (sessionRow.trainer_id !== trainerId) {
      return { status: "forbidden" };
    }
    if (sessionRow.closed_at) {
      return { status: "closed" };
    }
    const sanitizedName =
      typeof traineeName === "string"
        ? traineeName.trim().slice(0, 80) || null
        : null;
    const {
      rows: [updated],
    } = await client.query(
      "UPDATE sessions SET trainee_name = $1 WHERE id = $2 RETURNING *",
      [sanitizedName, sessionId],
    );
    return { status: "ok", session: mapSessionRow(updated) };
  });

export const closeSession = async ({ sessionId, trainerId }) => {
  const {
    rows: [sessionRow],
  } = await pool.query(
    "SELECT id, trainer_id, closed_at FROM sessions WHERE id = $1",
    [sessionId],
  );
  if (!sessionRow) {
    return { status: "not-found" };
  }
  if (sessionRow.trainer_id !== trainerId) {
    return { status: "forbidden" };
  }
  if (sessionRow.closed_at) {
    return { status: "ok", alreadyClosed: true };
  }
  await pool.query("UPDATE sessions SET closed_at = now() WHERE id = $1", [
    sessionId,
  ]);
  return { status: "ok" };
};

export const findActiveSessionByCode = async (code) => {
  const { rows } = await pool.query(
    `SELECT * FROM sessions
     WHERE code = $1
       AND closed_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [code],
  );
  return rows[0] ? mapSessionRow(rows[0]) : null;
};

export const expireSessions = async () => {
  const { rows } = await pool.query(
    `UPDATE sessions
     SET closed_at = now()
     WHERE closed_at IS NULL
       AND expires_at <= now()
     RETURNING id, code`,
  );
  return rows;
};
