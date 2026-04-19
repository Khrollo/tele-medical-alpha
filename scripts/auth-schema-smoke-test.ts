/**
 * Smoke test: verifies that Better Auth's configured user schema lines up
 * with the Drizzle users table.
 *
 * Catches:
 *  - additionalFields whose property name (or fieldName) does not exist on
 *    the Drizzle users schema (the bug that caused unable_to_create_user)
 *  - additionalFields whose declared type does not match the column type
 *  - mapProfileToUser keys that don't have a corresponding column
 *
 * Run: bun run scripts/auth-schema-smoke-test.ts
 *
 * No DATABASE_URL or network required - pure schema inspection.
 */
import { users } from "../app/_lib/db/drizzle/schema";

interface AdditionalField {
  type: string;
  required?: boolean;
  input?: boolean;
  fieldName?: string;
  defaultValue?: unknown;
}

// Mirror the additionalFields config from app/_lib/auth/auth.ts.
// Keep this in sync if you change auth config.
const additionalFields: Record<string, AdditionalField> = {
  role: { type: "string", defaultValue: "patient", input: true },
  avatarUrl: { type: "string", required: false, input: false },
  availability: { type: "string", defaultValue: "offline", input: false },
};

// Mirror mapProfileToUser keys for Google OAuth.
const mapProfileToUserKeys = ["name", "image", "avatarUrl", "emailVerified"];

// Built-in Better Auth user fields that should always be present.
const builtinUserFields = [
  "id",
  "email",
  "name",
  "emailVerified",
  "image",
  "createdAt",
  "updatedAt",
];

const errors: string[] = [];
const warnings: string[] = [];

function getSchemaColumns(): Record<string, { dataType: string; columnType: string }> {
  const cols: Record<string, { dataType: string; columnType: string }> = {};
  for (const [key, value] of Object.entries(users)) {
    const v = value as { dataType?: string; columnType?: string } | undefined;
    if (v && typeof v === "object" && "dataType" in v && "columnType" in v) {
      cols[key] = {
        dataType: v.dataType as string,
        columnType: v.columnType as string,
      };
    }
  }
  return cols;
}

const columns = getSchemaColumns();
const columnNames = new Set(Object.keys(columns));

console.log(`\nDrizzle users schema columns (${columnNames.size}):`);
for (const [name, info] of Object.entries(columns)) {
  console.log(`  - ${name}  (${info.dataType} / ${info.columnType})`);
}
console.log("");

console.log("Checking built-in Better Auth user fields...");
for (const field of builtinUserFields) {
  if (!columnNames.has(field)) {
    errors.push(
      `Built-in field "${field}" is missing from the users Drizzle schema`,
    );
  }
}

console.log("Checking additionalFields against users schema...");
for (const [propName, config] of Object.entries(additionalFields)) {
  const lookupKey = config.fieldName ?? propName;

  if (!columnNames.has(lookupKey)) {
    errors.push(
      `additionalFields.${propName} -> Better Auth will look up "${lookupKey}" on the users Drizzle schema, but it does not exist. ` +
        `Either remove fieldName, or rename the schema property.`,
    );
    continue;
  }

  const col = columns[lookupKey];
  const declared = config.type;
  if (
    declared === "string" &&
    !["string", "text", "varchar"].includes(col.dataType.toLowerCase()) &&
    !col.columnType.toLowerCase().includes("text") &&
    !col.columnType.toLowerCase().includes("enum")
  ) {
    warnings.push(
      `additionalFields.${propName} declared as "string" but column "${lookupKey}" has dataType "${col.dataType}" / columnType "${col.columnType}"`,
    );
  }
}

console.log("Checking mapProfileToUser keys against users schema...");
for (const key of mapProfileToUserKeys) {
  if (!columnNames.has(key)) {
    errors.push(
      `mapProfileToUser returns "${key}", but users Drizzle schema has no such property`,
    );
  }
}

console.log("");
if (warnings.length > 0) {
  console.log("Warnings:");
  for (const w of warnings) console.log(`  ! ${w}`);
  console.log("");
}

if (errors.length > 0) {
  console.error("FAILED:");
  for (const e of errors) console.error(`  X ${e}`);
  console.error("");
  process.exit(1);
}

console.log("OK - auth user schema looks consistent with Drizzle users table.\n");
