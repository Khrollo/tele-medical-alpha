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

function logDbError(prop: string | symbol, error: unknown) {
  const propName = typeof prop === "symbol" ? prop.toString() : prop;
  // eslint-disable-next-line no-console
  console.error(`[db] error during db.${propName}:`, error);
  if (error instanceof Error) {
    // eslint-disable-next-line no-console
    console.error(`[db] stack:`, error.stack);
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause) {
      // eslint-disable-next-line no-console
      console.error(`[db] cause:`, cause);
    }
    const pgError = error as Error & {
      code?: string;
      detail?: string;
      table?: string;
      column?: string;
      constraint?: string;
    };
    if (pgError.code || pgError.detail || pgError.table) {
      // eslint-disable-next-line no-console
      console.error(`[db] pg fields:`, {
        code: pgError.code,
        detail: pgError.detail,
        table: pgError.table,
        column: pgError.column,
        constraint: pgError.constraint,
      });
    }
  }
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== "function") return value;
    return (...args: unknown[]) => {
      try {
        const result = (value as (...a: unknown[]) => unknown).apply(target, args);
        if (result && typeof (result as PromiseLike<unknown>).then === "function") {
          return (result as Promise<unknown>).catch((err) => {
            logDbError(prop, err);
            throw err;
          });
        }
        return result;
      } catch (err) {
        logDbError(prop, err);
        throw err;
      }
    };
  },
});

export type Schema = typeof schema;
