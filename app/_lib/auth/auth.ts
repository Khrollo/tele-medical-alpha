import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/app/_lib/db/drizzle/index";
import crypto from "crypto";

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:3000";

const extraTrustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const trustedOrigins = Array.from(
  new Set(
    [baseURL, ...extraTrustedOrigins, "http://localhost:3000"].filter(Boolean),
  ),
);

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  logger: {
    level: "debug",
    disabled: false,
    log: (level, message, ...args) => {
      const safeArgs = args.map((arg) => {
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
            ...(arg as unknown as Record<string, unknown>),
          };
        }
        return arg;
      });
      // eslint-disable-next-line no-console
      console.log(
        `[BetterAuth][${level}] ${message}`,
        safeArgs.length ? JSON.stringify(safeArgs, null, 2) : "",
      );
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // eslint-disable-next-line no-console
          console.log(
            "[BetterAuth] user.create.before payload:",
            JSON.stringify(user, null, 2),
          );
          return { data: user };
        },
        after: async (user) => {
          // eslint-disable-next-line no-console
          console.log(
            "[BetterAuth] user.create.after success, id:",
            (user as { id?: string })?.id,
          );
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          // eslint-disable-next-line no-console
          console.log(
            "[BetterAuth] account.create.before payload:",
            JSON.stringify(account, null, 2),
          );
          return { data: account };
        },
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      scope: ["email", "profile"],
      mapProfileToUser: (profile) => ({
        name: profile.name,
        image: profile.picture,
        avatarUrl: profile.picture,
        emailVerified: true,
      }),
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "patient",
        input: true,
      },
      avatarUrl: {
        type: "string",
        required: false,
        input: false,
        fieldName: "avatar_url",
      },
      availability: {
        type: "string",
        defaultValue: "offline",
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "patient",
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
