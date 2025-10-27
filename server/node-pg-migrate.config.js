import "dotenv/config";

const connectionString =
  process.env.DATABASE_URL ??
  `postgres://${process.env.PGUSER ?? "shiller"}:${process.env.PGPASSWORD ?? "shiller"}@${process.env.PGHOST ?? "127.0.0.1"}:${process.env.PGPORT ?? "5432"}/${process.env.PGDATABASE ?? "shiller_dev"}`;

export default {
  schema: "public",
  dir: "migrations",
  direction: "up",
  migrationsTable: "pgmigrations",
  databaseUrl: connectionString,
  createSchema: true,
};
