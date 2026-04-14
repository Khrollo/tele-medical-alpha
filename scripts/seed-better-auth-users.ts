/**
 * Seed demo doctor + nurse for Better Auth (email/password).
 *
 * Run: bun run db:seed-demo-users
 *
 * Better Auth sign-in requires an `accounts` row with provider_id = 'credential'
 * and account_id = user id. This script always ensures that row exists.
 *
 * Loads .env then .env.local. Uses DATABASE_URL.
 * Optionally tries HTTP sign-up first (BETTER_AUTH_URL / BASE_URL); if the server
 * is down, inserts users via SQL only.
 *
 * Emails: doctor.demo@telemedical.local, nurse.demo@telemedical.local
 * Password: DEMO_USER_PASSWORD ?? NEW_USER_PWD ?? "password"
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { generateId } from "@better-auth/core/utils/id";
import { hashPassword } from "better-auth/crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function applyEnvFile(path: string, overrideExisting: boolean) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!overrideExisting && process.env[key] !== undefined) continue;
    process.env[key] = val;
  }
}

applyEnvFile(join(root, ".env"), false);
applyEnvFile(join(root, ".env.local"), true);

const BASE_URL =
  process.env.BETTER_AUTH_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (set in .env or .env.local)");
  process.exit(1);
}

const demoPassword =
  process.env.DEMO_USER_PASSWORD ??
  process.env.NEW_USER_PWD ??
  "password";

const sql = postgres(DATABASE_URL, { max: 1 });

interface DemoUser {
  email: string;
  name: string;
  role: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "doctor.demo@telemedical.local",
    name: "Demo Doctor",
    role: "doctor",
  },
  {
    email: "nurse.demo@telemedical.local",
    name: "Demo Nurse",
    role: "nurse",
  },
];

function isUnreachableFetchError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  if (o.code === "ConnectionRefused") return true;
  const msg = String(o.message ?? "");
  if (msg.includes("Unable to connect") || msg.includes("ECONNREFUSED")) return true;
  const cause = o.cause;
  if (cause && typeof cause === "object") {
    const c = cause as Record<string, unknown>;
    if (c.code === "ECONNREFUSED" || c.code === "ConnectionRefused") return true;
  }
  return false;
}

async function upsertUserDb(emailLower: string, name: string, role: string) {
  const found = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(trim(email)) = ${emailLower} LIMIT 1
  `;
  if (found.length > 0) {
    await sql`
      UPDATE users
      SET name = ${name}, role = ${role}, updated_at = now()
      WHERE lower(trim(email)) = ${emailLower}
    `;
    console.log(`  [db]   ${emailLower} user updated (no HTTP)`);
    return;
  }
  await sql`
    INSERT INTO users (email, name, role)
    VALUES (${emailLower}, ${name}, ${role})
  `;
  console.log(`  [db]   ${emailLower} user inserted (no HTTP)`);
}

async function ensureCredentialAccount(emailLower: string, plainPassword: string) {
  const usersFound = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(trim(email)) = ${emailLower} LIMIT 1
  `;
  if (usersFound.length === 0) {
    console.warn(`  [warn] ${emailLower}: no user row — skip credential account`);
    return;
  }
  const userId = usersFound[0].id;
  const hashed = await hashPassword(plainPassword);

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM accounts
    WHERE user_id = ${userId} AND provider_id = 'credential'
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE accounts
      SET password = ${hashed}, updated_at = now()
      WHERE user_id = ${userId} AND provider_id = 'credential'
    `;
    console.log(`  [ok]   ${emailLower} credential password updated`);
    return;
  }

  const accountPk = generateId();
  await sql`
    INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
    VALUES (${accountPk}, ${userId}, ${userId}, 'credential', ${hashed}, now(), now())
  `;
  console.log(`  [ok]   ${emailLower} credential account created`);
}

async function seedUser(user: DemoUser) {
  const emailLower = user.email.trim().toLowerCase();

  if (process.env.SEED_USE_DB_ONLY !== "1") {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: BASE_URL,
        },
        body: JSON.stringify({
          email: emailLower,
          password: demoPassword,
          name: user.name,
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const msg = String(data?.message ?? "").toLowerCase();
        const code = data?.code;
        if (
          msg.includes("already") ||
          code === "USER_ALREADY_EXISTS" ||
          code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
        ) {
          console.log(`  [skip] ${emailLower} already exists — syncing role + credential`);
        } else {
          console.error(`  [fail] ${emailLower}:`, data);
          return;
        }
      } else {
        console.log(`  [ok]   ${emailLower} created via HTTP`);
      }
    } catch (e) {
      if (isUnreachableFetchError(e)) {
        console.log(
          `  [db]   ${emailLower} HTTP skipped (server unreachable — using DATABASE_URL only)`
        );
        await upsertUserDb(emailLower, user.name, user.role);
      } else {
        throw e;
      }
    }
  } else {
    await upsertUserDb(emailLower, user.name, user.role);
  }

  await sql`
    UPDATE users SET role = ${user.role}, name = ${user.name}, updated_at = now()
    WHERE lower(trim(email)) = ${emailLower}
  `;
  console.log(`  [ok]   ${emailLower} role set to "${user.role}"`);

  await ensureCredentialAccount(emailLower, demoPassword);
}

async function main() {
  console.log(
    `Seeding demo users (HTTP: ${BASE_URL}, SEED_USE_DB_ONLY=${process.env.SEED_USE_DB_ONLY ?? "0"})...\n`
  );

  for (const user of DEMO_USERS) {
    await seedUser(user);
  }

  await sql.end();
  console.log("\nDone. Sign in with the demo emails and DEMO_USER_PASSWORD / NEW_USER_PWD / password.");
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
