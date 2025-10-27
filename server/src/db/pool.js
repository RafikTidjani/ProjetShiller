import pg from "pg";
import dotenv from "dotenv";

dotenv.config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});

const { Pool } = pg;

const getConnectionString = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.PGUSER ?? "shiller";
  const password = process.env.PGPASSWORD ?? "shiller";
  const host = process.env.PGHOST ?? "127.0.0.1";
  const port = process.env.PGPORT ?? "5432";
  const database = process.env.PGDATABASE ?? "shiller_dev";
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
};

export const pool = new Pool({
  connectionString: getConnectionString(),
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

export const sql = async (strings, ...values) => {
  const text = strings.reduce(
    (acc, part, index) => `${acc}$${index}${part}`,
    "",
  );
  const params = values.map((value) =>
    typeof value === "boolean" ? (value ? 1 : 0) : value,
  );
  const cleanedText = text.replace("$0", "");
  return pool.query(cleanedText, params);
};

export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
