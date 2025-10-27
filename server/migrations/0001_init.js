/* eslint-disable camelcase */
export const shorthands = undefined;

export async function up(pgm) {
  await pgm.createExtension("pgcrypto", { ifNotExists: true });
  await pgm.createTable("trainers", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    email: { type: "text", notNull: true, unique: true },
    password_hash: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  await pgm.createTable("sessions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    trainer_id: {
      type: "uuid",
      notNull: true,
      references: "trainers",
      onDelete: "cascade",
    },
    code: { type: "varchar(6)", notNull: true, unique: true },
    trainee_name: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    expires_at: { type: "timestamptz", notNull: true },
    closed_at: { type: "timestamptz" },
    last_values: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });

  await pgm.createTable("session_events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    session_id: {
      type: "uuid",
      notNull: true,
      references: "sessions",
      onDelete: "cascade",
    },
    systolic: { type: "integer", notNull: true },
    diastolic: { type: "integer", notNull: true },
    heart_rate: { type: "integer", notNull: true },
    spo2: { type: "integer", notNull: true },
    flags: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  await pgm.createIndex("sessions", "trainer_id");
  await pgm.createIndex("sessions", "expires_at");
  await pgm.createIndex("session_events", "session_id");
  await pgm.createIndex("session_events", "created_at");
}

export async function down(pgm) {
  await pgm.dropTable("session_events");
  await pgm.dropTable("sessions");
  await pgm.dropTable("trainers");
}
