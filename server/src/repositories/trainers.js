import bcrypt from "bcryptjs";
import { pool } from "../db/pool.js";

const DEMO_EMAIL = process.env.DEMO_TRAINER_EMAIL ?? "formateur@demo.fr";
const DEMO_PASSWORD =
  process.env.DEMO_TRAINER_PASSWORD ?? "demo123";

const mapTrainerRow = (row) => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findTrainerByEmail = async (email) => {
  const { rows } = await pool.query(
    "SELECT id, email, password_hash, created_at, updated_at FROM trainers WHERE lower(email) = lower($1)",
    [email],
  );
  return rows[0] ? mapTrainerRow(rows[0]) : null;
};

export const ensureDemoTrainer = async () => {
  const existing = await findTrainerByEmail(DEMO_EMAIL);
  if (existing) {
    return existing;
  }
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows } = await pool.query(
    `INSERT INTO trainers (email, password_hash) VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, password_hash, created_at, updated_at`,
    [DEMO_EMAIL, hash],
  );
  if (rows[0]) {
    return mapTrainerRow(rows[0]);
  }
  return findTrainerByEmail(DEMO_EMAIL);
};
