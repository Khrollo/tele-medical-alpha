import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * This module is server-only and should never be imported in client components.
 * Drizzle ORM is used for type-safe database queries in server-side code.
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. Please add it to your .env.local file."
  );
}

// Use singleton pattern in development to avoid too many connections
declare global {
  // eslint-disable-next-line no-var
  var postgresClient: postgres.Sql | undefined;
}

let postgresClient: postgres.Sql;

if (process.env.NODE_ENV === "production") {
  postgresClient = postgres(process.env.DATABASE_URL, {
    max: 1,
  });
} else {
  if (!global.postgresClient) {
    global.postgresClient = postgres(process.env.DATABASE_URL, {
      max: 1,
    });
  }
  postgresClient = global.postgresClient;
}

export const db = drizzle(postgresClient, { schema });

// Export schema for use in queries
export type Schema = typeof schema;

