import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Drizzle client.
 *
 * The client is initialized lazily on first use so that importing this module
 * (e.g. during Next.js build's "Collecting page data" phase, or any static
 * analysis pass) does not require DATABASE_URL to be present and does not
 * open a connection. Connections are created the first time a query runs.
 */

declare global {
  // eslint-disable-next-line no-var
  var postgresClient: postgres.Sql | undefined;
  // eslint-disable-next-line no-var
  var drizzleDb: PostgresJsDatabase<typeof schema> | undefined;
}

function createPostgresClient(): postgres.Sql {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. Add it to your hosting provider's environment variables (or .env.local for development).",
    );
  }
  return postgres(databaseUrl, { max: 1 });
}

function getPostgresClient(): postgres.Sql {
  if (process.env.NODE_ENV === "production") {
    if (!global.postgresClient) {
      global.postgresClient = createPostgresClient();
    }
    return global.postgresClient;
  }

  if (!global.postgresClient) {
    global.postgresClient = createPostgresClient();
  }
  return global.postgresClient;
}

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!global.drizzleDb) {
    global.drizzleDb = drizzle(getPostgresClient(), { schema });
  }
  return global.drizzleDb;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    // IMPORTANT: do not wrap thenables. Drizzle's query builders implement
    // `.then` so they look like Promises, but they're chainable (.where(),
    // .from(), etc). Wrapping them in a real Promise breaks chaining.
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export type Schema = typeof schema;
