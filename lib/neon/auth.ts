import { createAuthClient } from "@neondatabase/auth/next";

export function isNeonAuthConfigured() {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
    process.env.NEON_AUTH_COOKIE_SECRET
  );
}

export const authClient = createAuthClient();
