/**
 * Seed demo users into Better Auth.
 *
 * Run with:  npx tsx scripts/seed-better-auth-users.ts
 *
 * Requires the dev server running at BASE_URL.
 * After sign-up, updates the role directly in Postgres via the DATABASE_URL.
 */

import postgres from "postgres";

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "demodoctor@telehealth.com",
    password: "Toonami9@1",
    name: "Demo Doctor",
    role: "doctor",
  },
  {
    email: "demonurse@telehealth.com",
    password: "Toonami9@1",
    name: "Demo Nurse",
    role: "nurse",
  },
];

async function seedUser(user: DemoUser) {
  const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE_URL,
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      name: user.name,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (
      data?.message?.toLowerCase().includes("already") ||
      data?.code === "USER_ALREADY_EXISTS"
    ) {
      console.log(`  [skip] ${user.email} already exists — updating role`);
    } else {
      console.error(`  [fail] ${user.email}:`, data);
      return;
    }
  } else {
    console.log(`  [ok]   ${user.email} created`);
  }

  await sql`UPDATE users SET role = ${user.role} WHERE email = ${user.email}`;
  console.log(`  [ok]   ${user.email} role set to "${user.role}"`);
}

async function main() {
  console.log(`Seeding demo users against ${BASE_URL}...\n`);

  for (const user of DEMO_USERS) {
    await seedUser(user);
  }

  await sql.end();
  console.log("\nDone.");
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
