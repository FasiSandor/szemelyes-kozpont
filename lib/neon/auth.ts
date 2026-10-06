import { createAuthClient } from "@neondatabase/auth";

export function isNeonAuthConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_NEON_AUTH_URL);
}

export function createNeonAuthClient() {
  const baseUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL;
  if (!baseUrl) throw new Error("Neon Auth URL nincs még beállítva.");
  return createAuthClient(baseUrl);
}
